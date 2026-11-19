import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DriveError,
  RESUMABLE_UPLOAD_BYTES,
  clearDriveToken,
  downloadDriveFile,
  importFileName,
  multipartBody,
  pickerLocale,
  planImport,
  requestDriveToken,
  uploadToDrive,
} from './google-drive';

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX = 20 * 1024 * 1024;

describe('planImport — sólo entra lo que la Documentación acepta', () => {
  it('acepta PDF, imágenes y documentos de Google; rechaza otros tipos y lo que pasa el tope', () => {
    const { accepted, rejected } = planImport(
      [
        { id: '1', name: 'plano.pdf', mimeType: 'application/pdf', sizeBytes: 1000 },
        { id: '2', name: 'Memoria', mimeType: 'application/vnd.google-apps.document' },
        { id: '3', name: 'obra.dwg', mimeType: 'image/vnd.dwg', sizeBytes: 1000 },
        { id: '4', name: 'enorme.png', mimeType: 'image/png', sizeBytes: MAX + 1 },
      ],
      { mimeTypes: ACCEPTED, maxBytes: MAX },
    );

    expect(accepted.map((f) => f.id)).toEqual(['1', '2']);
    expect(rejected.map((r) => [r.file.id, r.reason])).toEqual([
      ['3', 'fileType'],
      ['4', 'fileSize'],
    ]);
  });
});

describe('importFileName', () => {
  it('un documento de Google entra como PDF; un archivo común conserva su nombre', () => {
    expect(importFileName({ name: 'Memoria', mimeType: 'application/vnd.google-apps.document' })).toBe(
      'Memoria.pdf',
    );
    expect(importFileName({ name: 'Acta.pdf', mimeType: 'application/vnd.google-apps.document' })).toBe(
      'Acta.pdf',
    );
    expect(importFileName({ name: 'render.png', mimeType: 'image/png' })).toBe('render.png');
  });
});

describe('pickerLocale', () => {
  it('traduce el idioma de la app al del Picker', () => {
    expect(pickerLocale('es-ES')).toBe('es');
    expect(pickerLocale('es-AR')).toBe('es-419');
    expect(pickerLocale('pt')).toBe('pt-BR');
    expect(pickerLocale(undefined)).toBe('es');
  });
});

describe('multipartBody', () => {
  it('arma metadatos JSON y bytes con el separador', async () => {
    const body = multipartBody({ name: 'a.pdf' }, new Blob(['%PDF'], { type: 'application/pdf' }), 'XX');
    const text = await body.text();
    expect(text).toContain('--XX\r\nContent-Type: application/json');
    expect(text).toContain('{"name":"a.pdf"}');
    expect(text).toContain('Content-Type: application/pdf\r\n\r\n%PDF');
    expect(text.endsWith('--XX--')).toBe(true);
  });
});

describe('requestDriveToken', () => {
  beforeEach(() => clearDriveToken());
  afterEach(() => {
    delete window.google;
  });

  function fakeGoogle(behaviour: (cb: {
    callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void;
    error_callback?: (e: { type?: string }) => void;
  }) => void) {
    const initTokenClient = vi.fn((config) => ({ requestAccessToken: () => behaviour(config) }));
    window.google = { accounts: { oauth2: { initTokenClient } } };
    return initTokenClient;
  }

  it('pide drive.file, guarda el token en memoria y no vuelve a abrir el popup mientras vale', async () => {
    const init = fakeGoogle(({ callback }) => callback({ access_token: 'tok', expires_in: 3600 }));

    await expect(requestDriveToken('client')).resolves.toBe('tok');
    await expect(requestDriveToken('client')).resolves.toBe('tok');

    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0]![0]).toMatchObject({
      client_id: 'client',
      scope: 'https://www.googleapis.com/auth/drive.file',
    });
  });

  it('un popup bloqueado y un permiso negado tienen su propio código', async () => {
    fakeGoogle(({ error_callback }) => error_callback?.({ type: 'popup_failed_to_open' }));
    await expect(requestDriveToken('client')).rejects.toMatchObject({ code: 'popupBlocked' });

    fakeGoogle(({ callback }) => callback({ error: 'access_denied' }));
    await expect(requestDriveToken('client')).rejects.toMatchObject({ code: 'denied' });
  });

  it('sin el script de Google cargado, avisa en vez de romper', async () => {
    await expect(requestDriveToken('client')).rejects.toBeInstanceOf(DriveError);
  });
});

describe('downloadDriveFile / uploadToDrive', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('un archivo común se baja con alt=media; uno de Google se exporta a PDF', async () => {
    // Un `Response` por llamada: el cuerpo se lee una sola vez.
    fetchMock.mockImplementation(() => Promise.resolve(new Response(new Blob(['x']))));

    const plain = await downloadDriveFile('tok', { id: 'a1', name: 'p.pdf', mimeType: 'application/pdf' }, MAX);
    expect(fetchMock.mock.calls[0]![0]).toContain('/files/a1?alt=media');
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe('Bearer tok');
    expect(plain.type).toBe('application/pdf');

    const native = await downloadDriveFile(
      'tok',
      { id: 'g1', name: 'Memoria', mimeType: 'application/vnd.google-apps.document' },
      MAX,
    );
    expect(fetchMock.mock.calls[1]![0]).toContain('/files/g1/export?mimeType=application%2Fpdf');
    expect(native.name).toBe('Memoria.pdf');
  });

  it('una exportación de Google que Drive rechaza por tamaño se informa como tal', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 403 }));
    await expect(
      downloadDriveFile('tok', { id: 'g1', name: 'X', mimeType: 'application/vnd.google-apps.spreadsheet' }, MAX),
    ).rejects.toMatchObject({ code: 'exportTooLarge' });
  });

  it('sube en una sola petición lo chico y en partes lo grande', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: 'd1', webViewLink: 'https://drive/d1' }));
    const small = await uploadToDrive('tok', new Blob(['abc'], { type: 'application/pdf' }), {
      name: 'a.pdf',
      folderId: 'f1',
    });
    expect(small.id).toBe('d1');
    expect(fetchMock.mock.calls[0]![0]).toContain('uploadType=multipart');

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { Location: 'https://upload/session' } }))
      .mockResolvedValueOnce(Response.json({ id: 'd2' }));
    const big = new Blob([new Uint8Array(RESUMABLE_UPLOAD_BYTES + 1)], { type: 'application/pdf' });
    await uploadToDrive('tok', big, { name: 'b.pdf', folderId: 'f1' });

    expect(fetchMock.mock.calls[0]![0]).toContain('uploadType=resumable');
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ name: 'b.pdf', parents: ['f1'] });
    expect(fetchMock.mock.calls[1]![0]).toBe('https://upload/session');
  });

  it('una subida que falla se informa con su código', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));
    await expect(
      uploadToDrive('tok', new Blob(['a']), { name: 'a.pdf', folderId: 'f1' }),
    ).rejects.toMatchObject({ code: 'upload' });
  });
});
