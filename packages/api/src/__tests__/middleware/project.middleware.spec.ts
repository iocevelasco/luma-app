import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre en unit lo que el E2E no puede: la rama de "no tiene acceso" no se
 * ejercita con dos cuentas reales invitadas entre sí, así que el aislamiento
 * (404, nunca 403) se prueba acá mockeando los modelos.
 */
vi.mock('../../models/Project.js', () => ({
  Project: { findById: vi.fn() },
}));
vi.mock('../../models/ProjectClient.js', () => ({
  ProjectClient: { exists: vi.fn() },
}));

const { Project } = await import('../../models/Project.js');
const { ProjectClient } = await import('../../models/ProjectClient.js');
const { requireProjectAccess, requireProjectOwner } = await import(
  '../../middleware/project.middleware.js'
);

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireProjectAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('404 si la obra no existe', async () => {
    vi.mocked(Project.findById).mockResolvedValue(null);
    const req = { params: { projectId: 'p1' }, user: { sub: 'user-1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('404, no 403, si el usuario no es dueño ni cliente', async () => {
    vi.mocked(Project.findById).mockResolvedValue({ createdBy: 'other-user', _id: 'p1' } as never);
    vi.mocked(ProjectClient.exists).mockResolvedValue(null as never);
    const req = { params: { projectId: 'p1' }, user: { sub: 'user-1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar al dueño y marca isProjectOwner', async () => {
    vi.mocked(Project.findById).mockResolvedValue({ createdBy: 'user-1', _id: 'p1' } as never);
    const req = { params: { projectId: 'p1' }, user: { sub: 'user-1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.isProjectOwner).toBe(true);
  });

  it('deja pasar a un cliente invitado sin marcarlo dueño', async () => {
    vi.mocked(Project.findById).mockResolvedValue({ createdBy: 'other-user', _id: 'p1' } as never);
    vi.mocked(ProjectClient.exists).mockResolvedValue({ _id: 'row1' } as never);
    const req = { params: { projectId: 'p1' }, user: { sub: 'user-1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.isProjectOwner).toBe(false);
  });
});

describe('requireProjectOwner', () => {
  it('403 si no es dueño', () => {
    const req = { isProjectOwner: false } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireProjectOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar al dueño', () => {
    const req = { isProjectOwner: true } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireProjectOwner(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
