import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { getIntegrationsConfig } from '../../controllers/integrations-config.controller.js';

/**
 * El handler no confía sólo en el router: sin `req.user` no entrega las claves,
 * aunque alguien lo monte por error en un router sin `isAuthenticated`.
 */
describe('getIntegrationsConfig', () => {
  it('sin sesión no responde nada y pasa un UNAUTHENTICATED al errorHandler', () => {
    const res = { set: vi.fn(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();

    getIntegrationsConfig({} as never, res, next);

    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });
});
