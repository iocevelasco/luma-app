import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/User.js', () => ({ User: { findById: vi.fn() } }));

const { User } = await import('../../models/User.js');
const { CACHE_TTL_MS, clearTokenVersionCache, currentTokenVersion, forgetTokenVersion, tokenVersionOf } =
  await import('../../services/session.service.js');

/** `User.findById(id).select(...).lean()` resuelve a `doc`. */
function stored(doc: { tokenVersion?: number } | null) {
  vi.mocked(User.findById).mockReturnValue({
    select: () => ({ lean: () => Promise.resolve(doc) }),
  } as never);
}

describe('tokenVersionOf', () => {
  it('un token emitido antes de que existiera el campo cuenta como 0', () => {
    expect(tokenVersionOf({})).toBe(0);
    expect(tokenVersionOf({ tv: 3 })).toBe(3);
  });
});

describe('currentTokenVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTokenVersionCache();
  });

  it('lee la versión de la base; una cuenta anterior al campo es 0', async () => {
    stored({ tokenVersion: 4 });
    expect(await currentTokenVersion('u1')).toBe(4);

    stored({});
    expect(await currentTokenVersion('u2')).toBe(0);
  });

  it('una cuenta que no existe da null', async () => {
    stored(null);
    expect(await currentTokenVersion('u1')).toBeNull();
  });

  it('dentro del caché no vuelve a la base; pasado, sí', async () => {
    stored({ tokenVersion: 1 });
    await currentTokenVersion('u1', 0);
    stored({ tokenVersion: 2 });

    expect(await currentTokenVersion('u1', CACHE_TTL_MS - 1)).toBe(1);
    expect(await currentTokenVersion('u1', CACHE_TTL_MS)).toBe(2);
    expect(User.findById).toHaveBeenCalledTimes(2);
  });

  it('forgetTokenVersion hace regir el cambio en el request siguiente', async () => {
    stored({ tokenVersion: 1 });
    await currentTokenVersion('u1', 0);
    stored({ tokenVersion: 2 });

    forgetTokenVersion('u1');

    expect(await currentTokenVersion('u1', 1)).toBe(2);
  });
});
