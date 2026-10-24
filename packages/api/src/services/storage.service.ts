import { randomUUID } from 'node:crypto';
import { STORAGE_CONFIG } from '../config/app.config.js';

/**
 * Storage de archivos vía el microservicio `media-service` (HTTP + API key).
 * Evidencia fotográfica (RF-04) y documentación de obra comparten el mismo
 * cliente; lo único que cambia es el nombre con que se sube cada archivo.
 *
 * La `key` que esta capa devuelve y que los modelos persisten es el **id** que
 * asignó el media-service — ya no es una ruta en un bucket. Nadie fuera de
 * este archivo tiene que saber cómo se resuelve.
 *
 * Si no hay URL o API key, cada método falla explícito
 * (`StorageNotConfiguredError`) en vez de que la app entera no arranque por un
 * storage que nadie configuró todavía — mismo criterio que `email.service.ts`
 * con Resend.
 */

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('STORAGE_NOT_CONFIGURED');
    this.name = 'StorageNotConfiguredError';
  }
}

/** El media-service respondió con un error. `status` es el HTTP que devolvió. */
export class StorageRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StorageRequestError';
  }
}

/** El media-service no debería tardar; mejor cortar que dejar colgado el request del usuario. */
const REQUEST_TIMEOUT_MS = 30_000;
/** Tope de vida de una URL firmada en el media-service. */
const MAX_SIGNED_URL_TTL = 3600;

let warned = false;

function getConfig(): { baseUrl: string; apiKey: string } | null {
  if (!STORAGE_CONFIG.ENABLED) {
    if (!warned) {
      console.warn(
        '⚠️  [STORAGE] Sin MEDIA_SERVICE_*: el storage de archivos queda deshabilitado.',
      );
      warned = true;
    }
    return null;
  }
  return {
    baseUrl: STORAGE_CONFIG.BASE_URL as string,
    apiKey: STORAGE_CONFIG.API_KEY as string,
  };
}

async function request(
  cfg: { baseUrl: string; apiKey: string },
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${cfg.apiKey}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/** Arma un error legible con el mensaje del servicio (`{ error: { message } }`). */
async function toRequestError(res: Response, action: string): Promise<StorageRequestError> {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? '';
  } catch {
    // cuerpo vacío o no-JSON: alcanza con el status
  }
  return new StorageRequestError(
    res.status,
    `media-service: no se pudo ${action} (${res.status})${detail ? `: ${detail}` : ''}`,
  );
}

/**
 * Primitivas genéricas. Devuelven/reciben la `key` (= id del media-service).
 */

export interface PutObjectParams {
  /** Nombre con el que queda registrado el archivo en el media-service. */
  fileName: string;
  buffer: Buffer;
  contentType: string;
}

export async function putObject({
  fileName,
  buffer,
  contentType,
}: PutObjectParams): Promise<{ key: string }> {
  const cfg = getConfig();
  if (!cfg) throw new StorageNotConfiguredError();

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: contentType }), fileName);

  const res = await request(cfg, '/v1/files', { method: 'POST', body: form });
  if (!res.ok) throw await toRequestError(res, 'subir el archivo');

  const body = (await res.json()) as { id: string };
  return { key: body.id };
}

/**
 * No hace nada (silencioso) si el storage no está configurado o si el archivo
 * ya no existe: en ambos casos no hay nada ahí para borrar.
 */
export async function deleteObject(key: string): Promise<void> {
  const cfg = getConfig();
  if (!cfg) return;

  const res = await request(cfg, `/v1/files/${encodeURIComponent(key)}`, { method: 'DELETE' });
  if (res.ok || res.status === 404) return;
  throw await toRequestError(res, 'borrar el archivo');
}

/**
 * URL firmada de lectura, válida por `STORAGE_CONFIG.SIGNED_URL_TTL` segundos.
 * `null` si el storage no está configurado o el archivo ya no existe — quien
 * llama decide si eso es un error o simplemente "no hay nada que mostrar".
 */
export async function signObjectUrl(key: string): Promise<string | null> {
  const cfg = getConfig();
  if (!cfg) return null;

  const expiresIn = Math.min(Math.max(1, STORAGE_CONFIG.SIGNED_URL_TTL), MAX_SIGNED_URL_TTL);
  const res = await request(cfg, `/v1/files/${encodeURIComponent(key)}/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expires_in: expiresIn }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await toRequestError(res, 'firmar la URL');

  const body = (await res.json()) as { url: string };
  return body.url;
}

/**
 * Los bytes de un archivo, o `null` si ya no existe. Para lo que la API tiene
 * que servir ella misma: el navegador no puede leer los píxeles de una URL
 * firmada de otro dominio (para dibujarla en un PDF, por ejemplo) sin que el
 * media-service habilite CORS, y eso no está en nuestras manos.
 */
export async function readObject(
  key: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  const url = await signObjectUrl(key);
  if (!url) return null;

  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw await toRequestError(res, 'leer el archivo');

  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') ?? 'application/octet-stream',
  };
}

// ── Evidencia fotográfica de actividades (RF-04) ────────────────────────────

export interface UploadEvidencePhotoParams {
  projectId: string;
  activityId: string;
  buffer: Buffer;
  contentType: string;
  /** Con el punto incluido, ej. `.jpg`. */
  extension: string;
}

export async function uploadEvidencePhoto(
  params: UploadEvidencePhotoParams,
): Promise<{ key: string }> {
  return putObject({
    fileName: `evidence-${params.projectId}-${params.activityId}-${randomUUID()}${params.extension}`,
    buffer: params.buffer,
    contentType: params.contentType,
  });
}

export const deleteEvidencePhoto = deleteObject;
export const signEvidencePhotoUrl = signObjectUrl;

// ── Foto de referencia de un material ──────────────────────────────────────

export interface UploadMaterialPhotoParams {
  projectId: string;
  materialId: string;
  buffer: Buffer;
  contentType: string;
  /** Con el punto incluido, ej. `.jpg`. */
  extension: string;
}

/** Prefijo propio: se distingue de la evidencia de avance en el media-service. */
export async function uploadMaterialPhoto(
  params: UploadMaterialPhotoParams,
): Promise<{ key: string }> {
  return putObject({
    fileName: `material-${params.projectId}-${params.materialId}-${randomUUID()}${params.extension}`,
    buffer: params.buffer,
    contentType: params.contentType,
  });
}

// ── Documentación de obra: permisos, planos y renders ───────────────────────

export interface UploadProjectDocumentParams {
  projectId: string;
  buffer: Buffer;
  contentType: string;
  /** Con el punto incluido, ej. `.pdf`. */
  extension: string;
}

/**
 * Prefijo `document-` y no `evidence-` en el nombre: la evidencia de una obra
 * terminada se puede archivar; el permiso municipal de esa misma obra hay que
 * poder mostrarlo años después. Si el día de mañana el ciclo de vida difiere,
 * el prefijo ya distingue a unos de otros en el media-service.
 */
export async function uploadProjectDocument(
  params: UploadProjectDocumentParams,
): Promise<{ key: string }> {
  return putObject({
    fileName: `document-${params.projectId}-${randomUUID()}${params.extension}`,
    buffer: params.buffer,
    contentType: params.contentType,
  });
}

// ── Adjuntos de hitos: fotos del problema, actas, presupuestos ─────────────

export interface UploadMilestoneAttachmentParams {
  projectId: string;
  milestoneId: string;
  buffer: Buffer;
  contentType: string;
  /** Con el punto incluido, ej. `.jpg`. */
  extension: string;
}

/** Prefijo propio por el mismo motivo que `document-`: distinguirlos en el media-service. */
export async function uploadMilestoneAttachment(
  params: UploadMilestoneAttachmentParams,
): Promise<{ key: string }> {
  return putObject({
    fileName: `milestone-${params.projectId}-${params.milestoneId}-${randomUUID()}${params.extension}`,
    buffer: params.buffer,
    contentType: params.contentType,
  });
}

// ── Comprobantes de pago de la suscripción ──────────────────────────────────

/**
 * Prefijo propio: es plata que entra a Luma, no un documento de obra, y su
 * ciclo de vida es el de la contabilidad de Luma, no el de una obra.
 */
export async function uploadSubscriptionReceipt(params: {
  organizationId: string;
  buffer: Buffer;
  contentType: string;
  extension: string;
}): Promise<{ key: string }> {
  return putObject({
    fileName: `subscription-receipt-${params.organizationId}-${randomUUID()}${params.extension}`,
    buffer: params.buffer,
    contentType: params.contentType,
  });
}

