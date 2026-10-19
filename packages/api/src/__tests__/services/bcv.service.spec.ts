import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/ExchangeRate.js', () => ({
  ExchangeRate: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn() },
}));

const { ExchangeRate } = await import('../../models/ExchangeRate.js');
const { caracasDayKey, currentRate, parseBcvAmount, parseBcvPage, refreshBcvRate } = await import(
  '../../services/bcv.service.js'
);

/** Recorte real de la home del BCV del 2026-10-19 (fecha valor 2026-10-20). */
const REAL_PAGE = readFileSync(new URL('../fixtures/bcv-home.html', import.meta.url), 'utf8');

/** `ExchangeRate.findOne(...).sort(...)` resuelve a esto, en orden de llamada. */
function findOneReturns(...docs: unknown[]) {
  const mock = vi.mocked(ExchangeRate.findOne);
  mock.mockReset();
  for (const doc of docs) mock.mockReturnValueOnce({ sort: vi.fn().mockResolvedValue(doc) } as never);
}

describe('parseBcvAmount', () => {
  it.each([
    ['881,87690000', 881.8769],
    [' 988,97203073', 988.97203073],
    ['USD 36,12', 36.12],
    ['1.234,56', 1234.56],
    ['36.5', 36.5],
  ])('%s → %d', (raw, expected) => {
    expect(parseBcvAmount(raw)).toBe(expected);
  });

  it.each(['', 'sin dato', '0,00', '1,2,3'])('"%s" no es una tasa', (raw) => {
    expect(parseBcvAmount(raw)).toBeNull();
  });
});

describe('parseBcvPage', () => {
  it('lee dólar, euro y fecha valor de la página real', () => {
    expect(parseBcvPage(REAL_PAGE)).toEqual({
      usd: 881.8769,
      eur: 988.97203073,
      valueDate: '2026-10-20',
    });
  });

  it('si no está el dólar, tira en vez de adivinar', () => {
    expect(() => parseBcvPage(REAL_PAGE.replace('id="dolar"', 'id="otra-cosa"'))).toThrow(
      /dólar/,
    );
  });

  it('si no está la fecha valor, tira', () => {
    expect(() => parseBcvPage(REAL_PAGE.replaceAll('Fecha Valor', 'Fecha'))).toThrow(/fecha valor/);
  });

  it('una página de error del sitio no da tasa', () => {
    expect(() => parseBcvPage('<html><body>503 Service Unavailable</body></html>')).toThrow();
  });
});

describe('refreshBcvRate', () => {
  const now = new Date('2026-10-19T20:00:00.000Z');
  const fetchReal = () => Promise.resolve(REAL_PAGE);

  beforeEach(() => vi.clearAllMocks());

  it('si ya la teníamos, sólo confirma que sigue publicada', async () => {
    const existing = { usd: 881.8769, valueDate: '2026-10-20' };
    vi.mocked(ExchangeRate.findOneAndUpdate).mockResolvedValue(existing as never);

    const outcome = await refreshBcvRate(now, fetchReal);

    expect(outcome.status).toBe('confirmada');
    expect(ExchangeRate.findOneAndUpdate).toHaveBeenCalledWith(
      { source: 'bcv', valueDate: '2026-10-20', usd: 881.8769 },
      { $set: { lastSeenAt: now } },
      { new: true },
    );
    expect(ExchangeRate.create).not.toHaveBeenCalled();
  });

  it('una tasa nueva y creíble se guarda para usar', async () => {
    vi.mocked(ExchangeRate.findOneAndUpdate).mockResolvedValue(null);
    findOneReturns({ usd: 875.1 });
    vi.mocked(ExchangeRate.create).mockImplementation((doc) => Promise.resolve(doc) as never);

    const outcome = await refreshBcvRate(now, fetchReal);

    expect(outcome.status).toBe('nueva');
    expect(ExchangeRate.create).toHaveBeenCalledWith(
      expect.objectContaining({ usd: 881.8769, valueDate: '2026-10-20', flagged: false }),
    );
  });

  it('un salto de más del 20% se guarda marcado y NO se usa', async () => {
    vi.mocked(ExchangeRate.findOneAndUpdate).mockResolvedValue(null);
    findOneReturns({ usd: 36.5 });
    vi.mocked(ExchangeRate.create).mockImplementation((doc) => Promise.resolve(doc) as never);

    const outcome = await refreshBcvRate(now, fetchReal);

    expect(outcome.status).toBe('marcada');
    expect(ExchangeRate.create).toHaveBeenCalledWith(expect.objectContaining({ flagged: true }));
  });

  it('si el BCV no responde no guarda nada', async () => {
    await expect(refreshBcvRate(now, () => Promise.reject(new Error('timeout')))).rejects.toThrow(
      'timeout',
    );
    expect(ExchangeRate.create).not.toHaveBeenCalled();
  });
});

describe('currentRate', () => {
  it('caracasDayKey usa UTC-4: las 22:00 de Caracas siguen siendo hoy', () => {
    expect(caracasDayKey(new Date('2026-10-20T01:30:00.000Z'))).toBe('2026-10-19');
    expect(caracasDayKey(new Date('2026-10-20T04:00:00.000Z'))).toBe('2026-10-20');
  });

  it('usa la tasa cuya fecha valor ya llegó, no la de mañana', async () => {
    const now = new Date('2026-10-19T22:00:00.000Z'); // 18:00 en Caracas
    const today = { usd: 875.1, valueDate: '2026-10-19', source: 'bcv', lastSeenAt: now };
    findOneReturns(today, { lastSeenAt: now });

    const rate = await currentRate(now);

    expect(rate).toMatchObject({ usd: 875.1, valueDate: '2026-10-19', stale: false });
    expect(vi.mocked(ExchangeRate.findOne).mock.calls[0]![0]).toEqual({
      flagged: false,
      valueDate: { $lte: '2026-10-19' },
    });
  });

  it('pasadas 48 horas sin una lectura buena, está vieja', async () => {
    const now = new Date('2026-10-22T12:00:00.000Z');
    const old = new Date('2026-10-20T11:00:00.000Z');
    findOneReturns(
      { usd: 875.1, valueDate: '2026-10-19', source: 'bcv', lastSeenAt: old },
      { lastSeenAt: old },
    );

    expect((await currentRate(now))?.stale).toBe(true);
  });

  it('sin ninguna tasa, null', async () => {
    findOneReturns(null, null);
    expect(await currentRate(new Date())).toBeNull();
  });
});
