import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../../services/project-deletion.service.js', () => ({
  findRestorable: vi.fn(),
  listTrash: vi.fn(),
  moveToTrash: vi.fn(),
  restoreFromTrash: vi.fn(),
  summarizeDeletion: vi.fn(),
}));
vi.mock('../../services/subscription.service.js', () => ({ decideProjectCreation: vi.fn() }));
vi.mock('../../services/stripe.service.js', () => ({
  syncStripeExtras: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../controllers/project.controller.js', () => ({
  toProjectDTO: (p: { _id: string }) => ({ id: p._id }),
}));

const service = await import('../../services/project-deletion.service.js');
const { decideProjectCreation } = await import('../../services/subscription.service.js');
const { deleteProject, restoreProject } = await import(
  '../../controllers/project-deletion.controller.js'
);

function mockRes() {
  const res = {} as Response;
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function deleteReq(body: unknown): Request {
  return {
    user: { sub: 'u1' },
    body,
    project: { _id: 'p1', name: 'Casa Norte ', organization: 'org-1' },
  } as unknown as Request;
}

beforeEach(() => vi.clearAllMocks());

describe('deleteProject', () => {
  it('rechaza si el nombre no coincide, y no toca nada', async () => {
    const next = vi.fn() as unknown as NextFunction;
    await deleteProject(deleteReq({ confirmName: 'Otra obra' }), mockRes(), next);

    expect(service.moveToTrash).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('rechaza si no mandan el nombre', async () => {
    const next = vi.fn() as unknown as NextFunction;
    await deleteProject(deleteReq({}), mockRes(), next);

    expect(service.moveToTrash).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('con el nombre correcto la manda a la papelera y dice hasta cuándo', async () => {
    const purgeAt = new Date('2026-05-01T00:00:00.000Z');
    vi.mocked(service.moveToTrash).mockResolvedValue({ _id: 'p1', purgeAt } as never);
    const res = mockRes();
    const next = vi.fn() as unknown as NextFunction;

    await deleteProject(deleteReq({ confirmName: 'Casa Norte' }), res, next);

    expect(service.moveToTrash).toHaveBeenCalledWith(expect.objectContaining({ _id: 'p1' }), 'u1');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { projectId: 'p1', purgeAt: purgeAt.toISOString() },
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('restoreProject', () => {
  const restoreReq = () =>
    ({ user: { sub: 'u1' }, params: { projectId: 'p1' } }) as unknown as Request;

  it('404 si no está en la papelera de quien pregunta', async () => {
    vi.mocked(service.findRestorable).mockResolvedValue(null);
    const next = vi.fn() as unknown as NextFunction;
    await restoreProject(restoreReq(), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
    expect(service.restoreFromTrash).not.toHaveBeenCalled();
  });

  it('no restaura si eso pasaría el límite de obras de la prueba', async () => {
    vi.mocked(service.findRestorable).mockResolvedValue({
      _id: 'p1',
      status: 'active',
      organization: 'org-1',
    } as never);
    vi.mocked(decideProjectCreation).mockResolvedValue({
      allowed: false,
      code: 'PAID_PLAN_REQUIRED',
    } as never);
    const next = vi.fn() as unknown as NextFunction;

    await restoreProject(restoreReq(), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'PAID_PLAN_REQUIRED' }));
    expect(service.restoreFromTrash).not.toHaveBeenCalled();
  });

  it('restaura cuando hay lugar', async () => {
    const project = { _id: 'p1', status: 'active', organization: 'org-1' };
    vi.mocked(service.findRestorable).mockResolvedValue(project as never);
    vi.mocked(decideProjectCreation).mockResolvedValue({ allowed: true } as never);
    vi.mocked(service.restoreFromTrash).mockResolvedValue(project as never);
    const res = mockRes();

    await restoreProject(restoreReq(), res, vi.fn() as unknown as NextFunction);

    expect(res.json).toHaveBeenCalledWith({ success: true, data: { project: { id: 'p1' } } });
  });
});
