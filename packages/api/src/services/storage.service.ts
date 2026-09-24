import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { STORAGE_CONFIG } from '../config/app.config.js';

/**
 * Storage de archivos vía cualquier proveedor compatible con S3 (RF-04:
 * registro fotográfico de evidencia). Cliente perezoso: si no hay
 * credenciales, cada método falla explícito (`StorageNotConfiguredError`) en
 * vez de que la app entera no arranque por un storage que nadie configuró
 * todavía — mismo criterio que `email.service.ts` con Resend.
 */

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('STORAGE_NOT_CONFIGURED');
    this.name = 'StorageNotConfiguredError';
  }
}

let client: S3Client | null = null;
let warned = false;

function getClient(): S3Client | null {
  if (client) return client;
  if (!STORAGE_CONFIG.ENABLED) {
    if (!warned) {
      console.warn('⚠️  [STORAGE] Sin STORAGE_*: el registro fotográfico queda deshabilitado.');
      warned = true;
    }
    return null;
  }

  client = new S3Client({
    endpoint: STORAGE_CONFIG.ENDPOINT,
    region: STORAGE_CONFIG.REGION,
    credentials: {
      accessKeyId: STORAGE_CONFIG.ACCESS_KEY_ID as string,
      secretAccessKey: STORAGE_CONFIG.SECRET_ACCESS_KEY as string,
    },
    // Backblaze B2, R2 y la mayoría de los compatibles con S3 necesitan
    // path-style (bucket en el path) — el virtual-hosted style de AWS falla ahí.
    forcePathStyle: true,
  });
  return client;
}

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
  const s3 = getClient();
  if (!s3) throw new StorageNotConfiguredError();

  const key = `evidence/${params.projectId}/${params.activityId}/${randomUUID()}${params.extension}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: STORAGE_CONFIG.BUCKET,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
    }),
  );

  return { key };
}

/** No hace nada (silencioso) si el storage no está configurado: no hay nada ahí para borrar. */
export async function deleteEvidencePhoto(key: string): Promise<void> {
  const s3 = getClient();
  if (!s3) return;

  await s3.send(new DeleteObjectCommand({ Bucket: STORAGE_CONFIG.BUCKET, Key: key }));
}

/**
 * URL firmada de lectura, válida por `STORAGE_CONFIG.SIGNED_URL_TTL`
 * segundos. `null` si el storage no está configurado — quien llama decide
 * si eso es un error o simplemente "no hay nada que mostrar todavía".
 */
export async function signEvidencePhotoUrl(key: string): Promise<string | null> {
  const s3 = getClient();
  if (!s3) return null;

  return getSignedUrl(s3, new GetObjectCommand({ Bucket: STORAGE_CONFIG.BUCKET, Key: key }), {
    expiresIn: STORAGE_CONFIG.SIGNED_URL_TTL,
  });
}
