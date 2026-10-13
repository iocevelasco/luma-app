import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El SDK de Resend NO lanza cuando la API rechaza un mail (remitente sin
 * verificar, destinatario no permitido): devuelve `{ error }`. Tratarlo como
 * éxito dejaba una invitación "enviada" que nunca llegó, y a la persona sin
 * poder entrar.
 */
const send = vi.fn();

async function loadService(apiKey: string | undefined) {
  vi.resetModules();
  vi.doMock('../../config/app.config.js', () => ({
    EMAIL_CONFIG: { RESEND_API_KEY: apiKey, FROM: 'luma@test.dev', APP_NAME: 'Luma', ENABLED: true },
    SERVER_CONFIG: { APP_URL: 'https://luma.test/app' },
  }));
  vi.doMock('resend', () => ({
    Resend: class {
      emails = { send };
    },
  }));
  const { EmailService } = await import('../../services/email.service.js');
  return EmailService;
}

describe('EmailService.sendAccountActivationEmail', () => {
  beforeEach(() => {
    send.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  // Sin restaurar, los spies de `console` se filtran a los demás archivos.
  afterEach(() => vi.restoreAllMocks());

  it('devuelve true cuando Resend acepta el mail', async () => {
    send.mockResolvedValue({ data: { id: 'mail-1' }, error: null });
    const service = await loadService('re_key');

    await expect(service.sendAccountActivationEmail('ana@x.com', 'tok', 'Ana')).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'ana@x.com' }));
  });

  it('devuelve false cuando Resend rechaza el mail sin lanzar', async () => {
    send.mockResolvedValue({ data: null, error: { name: 'validation_error', message: 'only to yourself' } });
    const service = await loadService('re_key');

    await expect(service.sendAccountActivationEmail('ana@x.com', 'tok', 'Ana')).resolves.toBe(false);
  });

  it('devuelve false cuando el envío lanza', async () => {
    send.mockRejectedValue(new Error('network'));
    const service = await loadService('re_key');

    await expect(service.sendAccountActivationEmail('ana@x.com', 'tok', 'Ana')).resolves.toBe(false);
  });

  it('devuelve false sin API key, y no intenta enviar', async () => {
    const service = await loadService(undefined);

    await expect(service.sendAccountActivationEmail('ana@x.com', 'tok', 'Ana')).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it('el enlace del mail lleva el token sobre APP_URL', async () => {
    send.mockResolvedValue({ data: { id: 'mail-1' }, error: null });
    const service = await loadService('re_key');

    await service.sendAccountActivationEmail('ana@x.com', 'tok123', 'Ana');

    const sent = send.mock.calls[0]![0] as { html: string; text: string };
    expect(sent.text).toContain('https://luma.test/app/activate?token=tok123');
  });
});
