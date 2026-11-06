import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * El cableado entre una escritura HTTP y el aviso a la obra: se avisa sólo si
 * la respuesta salió bien, y lo que se avisa sale de la capacidad que la ruta
 * exigió. El hub tiene su propio test.
 */
vi.mock('../../services/live-hub.service.js', () => ({
  liveHub: { publish: vi.fn(), closeProject: vi.fn() },
}));

const { liveHub } = await import('../../services/live-hub.service.js');
const { publishLiveChanges, closeLiveOnAccessChange, changesProjectVisibility } = await import(
  '../../middleware/live.middleware.js'
);

function exchange(opts: {
  method?: string;
  status?: number;
  capability?: string;
  project?: boolean;
  body?: unknown;
}) {
  const res = Object.assign(new EventEmitter(), {
    statusCode: opts.status ?? 200,
    locals: { exercisedCapability: opts.capability } as Record<string, unknown>,
  }) as unknown as Response;
  const req = {
    method: opts.method ?? 'POST',
    project: opts.project === false ? undefined : { _id: 'p1' },
    body: opts.body,
  } as unknown as Request;
  const next = vi.fn();
  return { req, res, next, finish: () => res.emit('finish') };
}

describe('publishLiveChanges', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tras una escritura 2xx avisa los recursos de la capacidad que la ruta exigió', () => {
    const { req, res, next, finish } = exchange({ capability: 'material.write' });

    publishLiveChanges(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(liveHub.publish).not.toHaveBeenCalled(); // todavía no respondió

    finish();
    expect(liveHub.publish).toHaveBeenCalledWith('p1', ['materials']);
  });

  it('borrar una actividad avisa también a Materiales', () => {
    const { req, res, next, finish } = exchange({ method: 'DELETE', capability: 'activity.plan' });
    publishLiveChanges(req, res, next);
    finish();
    expect(liveHub.publish).toHaveBeenCalledWith('p1', ['activities', 'materials']);
  });

  it.each([400, 403, 404, 409, 500])('no avisa si la respuesta fue %i', (status) => {
    const { req, res, next, finish } = exchange({ status, capability: 'material.write' });
    publishLiveChanges(req, res, next);
    finish();
    expect(liveHub.publish).not.toHaveBeenCalled();
  });

  it.each(['GET', 'HEAD', 'OPTIONS'])('ni mira los %s', (method) => {
    const { req, res, next, finish } = exchange({ method, capability: 'material.read' });
    publishLiveChanges(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    finish();
    expect(liveHub.publish).not.toHaveBeenCalled();
  });

  it('no avisa si la ruta no exigió ninguna capacidad conocida', () => {
    const { req, res, next, finish } = exchange({ capability: undefined });
    publishLiveChanges(req, res, next);
    finish();
    expect(liveHub.publish).not.toHaveBeenCalled();
  });

  it('una capacidad que no toca nada en vivo avisa lista vacía (el hub la ignora)', () => {
    const { req, res, next, finish } = exchange({ capability: 'crew.manage' });
    publishLiveChanges(req, res, next);
    finish();
    expect(liveHub.publish).toHaveBeenCalledWith('p1', []);
  });

  it('sin obra resuelta no avisa', () => {
    const { req, res, next, finish } = exchange({ capability: 'material.write', project: false });
    publishLiveChanges(req, res, next);
    finish();
    expect(liveHub.publish).not.toHaveBeenCalled();
  });
});

describe('closeLiveOnAccessChange', () => {
  beforeEach(() => vi.clearAllMocks());

  it('tras un cambio exitoso corta las conexiones de la obra', () => {
    const { req, res, next, finish } = exchange({ method: 'PATCH' });
    closeLiveOnAccessChange()(req, res, next);
    expect(next).toHaveBeenCalledOnce();

    finish();
    expect(liveHub.closeProject).toHaveBeenCalledWith('p1', 'access-changed');
  });

  it('si el cambio falló, no corta a nadie', () => {
    const { req, res, next, finish } = exchange({ method: 'DELETE', status: 403 });
    closeLiveOnAccessChange()(req, res, next);
    finish();
    expect(liveHub.closeProject).not.toHaveBeenCalled();
  });

  it('con `when`, sólo corta si el cambio mueve permisos', () => {
    const edit = exchange({ method: 'PATCH', body: { name: 'Otro nombre' } });
    closeLiveOnAccessChange({ when: changesProjectVisibility })(edit.req, edit.res, edit.next);
    edit.finish();
    expect(liveHub.closeProject).not.toHaveBeenCalled();

    const flag = exchange({ method: 'PATCH', body: { purchasesVisibleToClient: true } });
    closeLiveOnAccessChange({ when: changesProjectVisibility })(flag.req, flag.res, flag.next);
    flag.finish();
    expect(liveHub.closeProject).toHaveBeenCalledWith('p1', 'access-changed');
  });
});

describe('changesProjectVisibility', () => {
  const req = (body: unknown) => ({ body }) as unknown as Request;

  it('detecta los dos flags que le abren secciones al cliente', () => {
    expect(changesProjectVisibility(req({ purchasesVisibleToClient: false }))).toBe(true);
    expect(changesProjectVisibility(req({ providersVisibleToClient: true }))).toBe(true);
  });

  it('una edición común no toca permisos', () => {
    expect(changesProjectVisibility(req({ name: 'x', estimatedEndDate: '2027-01-01' }))).toBe(false);
    expect(changesProjectVisibility(req(undefined))).toBe(false);
    expect(changesProjectVisibility(req('texto'))).toBe(false);
  });
});
