import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `STORAGE_CONFIG` se calcula al importar el módulo de config, así que cada
 * test fija el entorno y re-importa el servicio desde cero.
 */
async function loadService(env: Record<string, string | undefined>) {
  vi.resetModules();
  vi.stubEnv('MEDIA_SERVICE_URL', env.MEDIA_SERVICE_URL ?? '');
  vi.stubEnv('MEDIA_SERVICE_API_KEY', env.MEDIA_SERVICE_API_KEY ?? '');
  vi.stubEnv('STORAGE_SIGNED_URL_TTL', env.STORAGE_SIGNED_URL_TTL ?? '');
  return import('../../services/storage.service.js');
}

const CONFIGURED = {
  MEDIA_SERVICE_URL: 'https://media.example.com/',
  MEDIA_SERVICE_API_KEY: 'bk_test_key',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('storage.service (media-service)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('sin configuración: subir falla explícito, firmar da null y borrar no hace nada', async () => {
    const svc = await loadService({});

    await expect(
      svc.putObject({ fileName: 'a.pdf', buffer: Buffer.from('x'), contentType: 'application/pdf' }),
    ).rejects.toBeInstanceOf(svc.StorageNotConfiguredError);
    await expect(svc.signObjectUrl('abc')).resolves.toBeNull();
    await expect(svc.deleteObject('abc')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sube multipart con Bearer y devuelve el id como key', async () => {
    const svc = await loadService(CONFIGURED);
    fetchMock.mockResolvedValue(jsonResponse({ id: 'file-123' }, 201));

    const result = await svc.uploadProjectDocument({
      projectId: 'proj-1',
      buffer: Buffer.from('%PDF-1.4'),
      contentType: 'application/pdf',
      extension: '.pdf',
    });

    expect(result).toEqual({ key: 'file-123' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://media.example.com/v1/files'); // sin doble barra
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer bk_test_key');
    const form = init.body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toMatch(/^document-proj-1-.+\.pdf$/);
    expect(file.type).toBe('application/pdf');
  });

  it('propaga el mensaje del servicio cuando la subida falla', async () => {
    const svc = await loadService(CONFIGURED);
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'quota_exceeded', message: 'cuota excedida' } }, 413),
    );

    await expect(
      svc.putObject({ fileName: 'a.png', buffer: Buffer.from('x'), contentType: 'image/png' }),
    ).rejects.toMatchObject({ status: 413, message: expect.stringContaining('cuota excedida') });
  });

  it('firma la URL pidiendo el TTL configurado y lo acota a 3600', async () => {
    const svc = await loadService({ ...CONFIGURED, STORAGE_SIGNED_URL_TTL: '99999' });
    fetchMock.mockResolvedValue(jsonResponse({ url: 'https://media.example.com/v1/f/x?sig=1' }));

    const url = await svc.signObjectUrl('file-123');

    expect(url).toBe('https://media.example.com/v1/f/x?sig=1');
    const [target, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(target).toBe('https://media.example.com/v1/files/file-123/url');
    expect(JSON.parse(init.body as string)).toEqual({ expires_in: 3600 });
  });

  it('firmar un archivo que ya no existe da null, no un error', async () => {
    const svc = await loadService(CONFIGURED);
    fetchMock.mockResolvedValue(jsonResponse({ error: { message: 'no encontrado' } }, 404));

    await expect(svc.signObjectUrl('gone')).resolves.toBeNull();
  });

  it('borrar tolera 404 pero propaga otros errores', async () => {
    const svc = await loadService(CONFIGURED);

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(svc.deleteObject('a')).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'x' } }, 404));
    await expect(svc.deleteObject('b')).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'boom' } }, 502));
    await expect(svc.deleteObject('c')).rejects.toMatchObject({ status: 502 });
  });
});
