/**
 * Google Drive desde el navegador (ADR-005 §4): importar archivos a la
 * Documentación de una obra y exportar documentos al Drive de la persona.
 *
 * Todo pasa entre el navegador y Google: la API de Luma no habla con Drive ni
 * guarda tokens. El permiso es `drive.file` (sólo los archivos que la persona
 * elige o que la app crea), un scope no sensible: no hay verificación de Google.
 *
 * Sin paquetes npm, como `stripe-js.ts`: Google exige servir estos scripts desde
 * sus dominios. Se tipa sólo lo que se usa.
 */

import type { GoogleIdApi } from './google-identity';
import type { GoogleMapsNamespace } from './google-places';
import { GSI_URL, loadGoogleScript } from './google-scripts';

const GAPI_URL = 'https://apis.google.com/js/api.js';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Documentos nativos de Google: no tienen bytes propios, se exportan a PDF. */
export const GOOGLE_NATIVE_MIME_TYPES: readonly string[] = [
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
];

/** Pasado esto, la subida a Drive va en partes (Google recomienda resumable desde 5 MB). */
export const RESUMABLE_UPLOAD_BYTES = 5 * 1024 * 1024;

export type DriveErrorCode =
  | 'unavailable'
  | 'popupBlocked'
  | 'denied'
  | 'download'
  | 'upload'
  | 'exportTooLarge'
  | 'sheet'
  | 'sheetRead';

/** Un error de Google no es un `ApiError`: la UI lo traduce por `code` (`document.drive.errors.*`). */
export class DriveError extends Error {
  constructor(public readonly code: DriveErrorCode) {
    super(code);
    this.name = 'DriveError';
  }
}

export interface DriveConfig {
  clientId: string;
  apiKey: string;
  appId: string;
}

/** Un archivo elegido en el Picker. */
export interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
  /** Google no informa tamaño de los documentos nativos. */
  sizeBytes?: number;
}

// ── Tipos mínimos de los scripts de Google ──────────────────────────────────

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface PickerDoc {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number | string;
}

interface PickerData {
  action: string;
  docs?: PickerDoc[];
}

interface DocsView {
  setMimeTypes(types: string): DocsView;
  setIncludeFolders(include: boolean): DocsView;
  setSelectFolderEnabled(enabled: boolean): DocsView;
}

interface PickerBuilder {
  setAppId(id: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setLocale(locale: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  addView(view: DocsView): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setCallback(callback: (data: PickerData) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}

interface GoogleNamespace {
  /** Maps JavaScript, para el autocompletado de direcciones (`google-places.ts`). */
  maps?: GoogleMapsNamespace;
  accounts?: {
    /** Entrar con Google (`google-identity.ts`). */
    id?: GoogleIdApi;
    oauth2?: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }): TokenClient;
    };
  };
  picker?: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: string) => DocsView;
    ViewId: { DOCS: string; FOLDERS: string };
    Feature: { MULTISELECT_ENABLED: string };
    Action: { PICKED: string; CANCEL: string };
  };
}

interface GapiNamespace {
  load(library: string, options: { callback: () => void; onerror?: () => void }): void;
}

declare global {
  interface Window {
    google?: GoogleNamespace;
    gapi?: GapiNamespace;
  }
}

// ── Carga de scripts ────────────────────────────────────────────────────────

/** El cargador compartido, con el error que la UI de Drive sabe traducir. */
function loadScript(url: string, isReady: () => boolean): Promise<void> {
  return loadGoogleScript(url, isReady).catch(() => {
    throw new DriveError('unavailable');
  });
}

const gsiReady = () => typeof window.google?.accounts?.oauth2?.initTokenClient === 'function';
const pickerReady = () => typeof window.google?.picker?.PickerBuilder === 'function';

let pickerLoading: Promise<void> | null = null;

/**
 * Carga los dos scripts **antes** del clic. En Safari, una carga asíncrona entre
 * el clic y el popup del permiso hace que el navegador lo bloquee: el popup
 * tiene que abrirse dentro del mismo gesto.
 */
export function preloadGoogleDrive(): Promise<void> {
  pickerLoading ??= Promise.all([
    loadScript(GSI_URL, gsiReady),
    loadScript(GAPI_URL, () => typeof window.gapi?.load === 'function').then(
      () =>
        new Promise<void>((resolve, reject) => {
          if (pickerReady()) return resolve();
          window.gapi!.load('picker', {
            callback: () => (pickerReady() ? resolve() : reject(new DriveError('unavailable'))),
            onerror: () => reject(new DriveError('unavailable')),
          });
        }),
    ),
  ])
    .then(() => undefined)
    .catch((error: unknown) => {
      pickerLoading = null;
      throw error;
    });
  return pickerLoading;
}

export function isGoogleDriveLoaded(): boolean {
  return gsiReady() && pickerReady();
}

// ── Permiso ─────────────────────────────────────────────────────────────────

/** El token vive sólo en memoria, unos minutos. Nunca en storage ni en la URL. */
let cachedToken: { value: string; expiresAt: number } | null = null;

/** Margen para no usar un token que vence en medio de una subida. */
const TOKEN_MARGIN_MS = 60_000;

/**
 * Pide el permiso `drive.file`. Tiene que llamarse dentro del clic de la persona
 * (abre un popup de Google la primera vez) y con los scripts ya cargados.
 */
export function requestDriveToken(clientId: string, now = Date.now()): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - TOKEN_MARGIN_MS > now) {
    return Promise.resolve(cachedToken.value);
  }
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2 || typeof oauth2.initTokenClient !== 'function') {
    return Promise.reject(new DriveError('unavailable'));
  }

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new DriveError('denied'));
          return;
        }
        cachedToken = {
          value: response.access_token,
          expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000,
        };
        resolve(response.access_token);
      },
      error_callback: (error) =>
        reject(new DriveError(error.type === 'popup_failed_to_open' ? 'popupBlocked' : 'denied')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}

/**
 * Olvida el permiso de Drive. Lo llama `clearSession` al cerrar sesión: el
 * token es de la cuenta de Google de quien lo pidió, no de la pestaña.
 */
export function clearDriveToken(): void {
  cachedToken = null;
}

// ── Picker ──────────────────────────────────────────────────────────────────

/** El idioma de la app en el formato del Picker. */
export function pickerLocale(language: string | undefined): string {
  if (!language) return 'es';
  if (language === 'es-AR') return 'es-419';
  if (language.startsWith('pt')) return 'pt-BR';
  if (language.startsWith('es')) return 'es';
  return language;
}

interface PickOptions {
  config: DriveConfig;
  token: string;
  locale: string;
  title: string;
}

function openPicker(view: DocsView, { config, token, locale, title }: PickOptions, multi: boolean) {
  const picker = window.google?.picker;
  if (!picker) return Promise.reject(new DriveError('unavailable'));

  return new Promise<PickerDoc[] | null>((resolve) => {
    let builder = new picker.PickerBuilder()
      .setAppId(config.appId)
      .setDeveloperKey(config.apiKey)
      .setOAuthToken(token)
      .setLocale(locale)
      .setTitle(title)
      .addView(view)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED) resolve(data.docs ?? []);
        else if (data.action === picker.Action.CANCEL) resolve(null);
      });
    if (multi) builder = builder.enableFeature(picker.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  });
}

function toPicked(doc: PickerDoc): PickedFile {
  const size = Number(doc.sizeBytes);
  return {
    id: doc.id,
    name: doc.name,
    mimeType: doc.mimeType,
    sizeBytes: Number.isFinite(size) && size > 0 ? size : undefined,
  };
}

/** Elegir archivos para importar. `null` = la persona cerró el Picker. */
export async function pickFilesToImport(
  options: PickOptions,
  mimeTypes: readonly string[],
): Promise<PickedFile[] | null> {
  const picker = window.google?.picker;
  if (!picker) throw new DriveError('unavailable');
  const view = new picker.DocsView(picker.ViewId.DOCS)
    .setMimeTypes([...mimeTypes, ...GOOGLE_NATIVE_MIME_TYPES].join(','))
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);
  const docs = await openPicker(view, options, true);
  return docs ? docs.map(toPicked) : null;
}

/** Elegir una Google Sheet para leerla. `null` = la persona cerró el Picker. */
export async function pickSpreadsheet(options: PickOptions): Promise<PickedFile | null> {
  const picker = window.google?.picker;
  if (!picker) throw new DriveError('unavailable');
  const view = new picker.DocsView(picker.ViewId.DOCS)
    .setMimeTypes('application/vnd.google-apps.spreadsheet')
    .setIncludeFolders(true)
    .setSelectFolderEnabled(false);
  const docs = await openPicker(view, options, false);
  return docs?.[0] ? toPicked(docs[0]) : null;
}

/** Elegir la carpeta destino de una exportación. `null` = la persona cerró el Picker. */
export async function pickExportFolder(options: PickOptions): Promise<string | null> {
  const picker = window.google?.picker;
  if (!picker) throw new DriveError('unavailable');
  const view = new picker.DocsView(picker.ViewId.FOLDERS)
    .setMimeTypes(DRIVE_FOLDER_MIME)
    .setIncludeFolders(true)
    .setSelectFolderEnabled(true);
  const docs = await openPicker(view, options, false);
  return docs?.[0]?.id ?? null;
}

// ── Reglas puras (con tests) ────────────────────────────────────────────────

export function isGoogleNative(mimeType: string): boolean {
  return GOOGLE_NATIVE_MIME_TYPES.includes(mimeType);
}

/** El nombre con que entra a Luma: un documento nativo se exporta a PDF. */
export function importFileName(file: Pick<PickedFile, 'name' | 'mimeType'>): string {
  if (!isGoogleNative(file.mimeType)) return file.name;
  return /\.pdf$/i.test(file.name) ? file.name : `${file.name}.pdf`;
}

export type ImportRejection = 'fileType' | 'fileSize';

/**
 * Qué se puede importar y qué no, antes de bajar nada: sólo lo que la
 * Documentación acepta hoy, y el tamaño se mira en los metadatos. Un documento
 * nativo se acepta y su tamaño se mira después de exportarlo.
 */
export function planImport(
  files: PickedFile[],
  { mimeTypes, maxBytes }: { mimeTypes: readonly string[]; maxBytes: number },
): { accepted: PickedFile[]; rejected: Array<{ file: PickedFile; reason: ImportRejection }> } {
  const accepted: PickedFile[] = [];
  const rejected: Array<{ file: PickedFile; reason: ImportRejection }> = [];
  for (const file of files) {
    if (!isGoogleNative(file.mimeType) && !mimeTypes.includes(file.mimeType)) {
      rejected.push({ file, reason: 'fileType' });
    } else if (file.sizeBytes !== undefined && file.sizeBytes > maxBytes) {
      rejected.push({ file, reason: 'fileSize' });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

/** El cuerpo `multipart/related` de una subida chica: metadatos JSON + bytes. */
export function multipartBody(
  metadata: Record<string, unknown>,
  content: Blob,
  boundary: string,
): Blob {
  return new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\nContent-Type: ${content.type || 'application/octet-stream'}\r\n\r\n`,
    content,
    `\r\n--${boundary}--`,
  ]);
}

// ── Bajar y subir ───────────────────────────────────────────────────────────

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

/** Baja un archivo de Drive como `File`; un documento nativo, exportado a PDF. */
export async function downloadDriveFile(
  token: string,
  file: PickedFile,
  maxBytes: number,
): Promise<File> {
  const native = isGoogleNative(file.mimeType);
  const url = native
    ? `${DRIVE_FILES}/${encodeURIComponent(file.id)}/export?mimeType=application%2Fpdf`
    : `${DRIVE_FILES}/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;

  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    // Google corta la exportación de documentos muy grandes (cerca de 10 MB).
    throw new DriveError(native && response.status === 403 ? 'exportTooLarge' : 'download');
  }
  const blob = await response.blob();
  if (blob.size > maxBytes) throw new DriveError(native ? 'exportTooLarge' : 'download');

  const type = native ? 'application/pdf' : file.mimeType;
  return new File([blob], importFileName(file), { type });
}

export interface UploadedDriveFile {
  id: string;
  webViewLink?: string;
}

/** Sube un archivo al Drive de la persona, en la carpeta elegida. */
export async function uploadToDrive(
  token: string,
  content: Blob,
  { name, folderId }: { name: string; folderId: string },
): Promise<UploadedDriveFile> {
  const metadata = { name, parents: [folderId] };
  const auth = { Authorization: `Bearer ${token}` };
  const fields = 'fields=id,webViewLink&supportsAllDrives=true';

  let response: Response;
  if (content.size <= RESUMABLE_UPLOAD_BYTES) {
    const boundary = `luma-${Math.random().toString(36).slice(2)}`;
    response = await fetch(`${DRIVE_UPLOAD}?uploadType=multipart&${fields}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipartBody(metadata, content, boundary),
    });
  } else {
    const session = await fetch(`${DRIVE_UPLOAD}?uploadType=resumable&${fields}`, {
      method: 'POST',
      headers: {
        ...auth,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': content.type || 'application/octet-stream',
        'X-Upload-Content-Length': String(content.size),
      },
      body: JSON.stringify(metadata),
    });
    const location = session.headers.get('Location');
    if (!session.ok || !location) throw new DriveError('upload');
    response = await fetch(location, { method: 'PUT', body: content });
  }

  if (!response.ok) throw new DriveError('upload');
  return (await response.json()) as UploadedDriveFile;
}
