import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * En producción el verificador escribía en el log los primeros 10 caracteres de
 * `RECAPTCHA_SECRET_KEY` en cada login y cada registro. Un log lo lee más gente
 * y más sistemas que el entorno: de la clave sólo se puede decir si está.
 *
 * Este archivo está lleno de logs de diagnóstico, y el próximo que depure un
 * reCAPTCHA que falla va a querer "ver qué clave tomó": esto lo frena.
 */
const SECRET = 'Zq7x-Kp3v_Wm9t-Rb5n_Yc2h-Jd8f';

vi.mock('../../config/app.config.js', () => ({
  isProduction: true,
  RECAPTCHA_CONFIG: {
    SECRET_KEY: SECRET,
    VERIFY_URL: 'https://recaptcha.test/siteverify',
    DEFAULT_THRESHOLD: 0.5,
  },
}));

const { verifyRecaptchaToken } = await import('../../services/recaptcha.service.js');

/** Todo lo que salió por consola, en un solo texto. */
function logged(spies: ReturnType<typeof vi.spyOn>[]): string {
  return spies
    .flatMap((spy) => spy.mock.calls.flat())
    .map((arg) => (typeof arg === 'string' ? arg : (JSON.stringify(arg) ?? String(arg))))
    .join('\n');
}

/** Ni entera ni en pedazos: cualquier tramo de 6 caracteres de la clave cuenta. */
function leaksSecret(text: string): boolean {
  for (let start = 0; start + 6 <= SECRET.length; start += 1) {
    if (text.includes(SECRET.slice(start, start + 6))) return true;
  }
  return false;
}

function googleAnswers(body: unknown, status = 200) {
  const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('verifyRecaptchaToken — la clave secreta no sale en el log', () => {
  let spies: ReturnType<typeof vi.spyOn>[];

  beforeEach(() => {
    vi.stubEnv('SKIP_RECAPTCHA', '');
    spies = (['log', 'warn', 'error'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('en una verificación que pasa, sólo dice si la clave está configurada', async () => {
    const fetchMock = googleAnswers({ success: true, score: 0.9, action: 'login' });

    const result = await verifyRecaptchaToken('un-token', 'login');

    expect(result.success).toBe(true);
    // La clave se usó de verdad —viajó a Google en el cuerpo—, y aun así no se logueó.
    expect(String(fetchMock.mock.calls[0]![1]!.body)).toContain(encodeURIComponent(SECRET));
    const output = logged(spies);
    expect(output).toContain('Secret key configured: true');
    expect(leaksSecret(output)).toBe(false);
  });

  it.each([
    ['el token es inválido y Google no reconoce el dominio', { success: false, 'error-codes': ['invalid-input-response'] }, 200],
    ['el navegador falló', { success: false, 'error-codes': ['browser-error'], hostname: 'luma.test' }, 200],
    ['el puntaje es bajo', { success: true, score: 0.1, action: 'login' }, 200],
    ['la acción no coincide', { success: true, score: 0.9, action: 'register' }, 200],
    ['Google responde con un error HTTP', { error: 'boom' }, 500],
  ])('tampoco cuando %s', async (_caso, body, status) => {
    googleAnswers(body, status);

    const result = await verifyRecaptchaToken('un-token', 'login');

    expect(result.success).toBe(false);
    expect(leaksSecret(logged(spies))).toBe(false);
    expect(leaksSecret(result.error ?? '')).toBe(false);
  });

  it('tampoco cuando la llamada a Google revienta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sin red')));

    const result = await verifyRecaptchaToken('un-token', 'login');

    expect(result.success).toBe(false);
    expect(leaksSecret(logged(spies))).toBe(false);
  });
});
