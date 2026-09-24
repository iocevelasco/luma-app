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
vi.mock('../../models/OrganizationMember.js', () => ({
  OrganizationMember: { exists: vi.fn() },
}));

const { Project } = await import('../../models/Project.js');
const { ProjectClient } = await import('../../models/ProjectClient.js');
const { OrganizationMember } = await import('../../models/OrganizationMember.js');
const { requireProjectAccess, requireProjectOwner, requireProjectEditor } = await import(
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

  it('404, no 403, si el usuario no es dueño, asistente ni cliente', async () => {
    vi.mocked(Project.findById).mockResolvedValue({
      createdBy: 'other-user',
      organization: 'org-1',
      _id: 'p1',
    } as never);
    vi.mocked(OrganizationMember.exists).mockResolvedValue(null as never);
    vi.mocked(ProjectClient.exists).mockResolvedValue(null as never);
    const req = { params: { projectId: 'p1' }, user: { sub: 'user-1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar al dueño y marca isProjectOwner + isProjectEditor', async () => {
    vi.mocked(Project.findById).mockResolvedValue({
      createdBy: 'user-1',
      organization: 'org-1',
      _id: 'p1',
    } as never);
    const req = { params: { projectId: 'p1' }, user: { sub: 'user-1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.isProjectOwner).toBe(true);
    expect(req.isProjectEditor).toBe(true);
    // Es dueño: ni siquiera hace falta ir a buscar la membresía.
    expect(OrganizationMember.exists).not.toHaveBeenCalled();
  });

  it('deja pasar a un cliente invitado sin marcarlo dueño ni editor', async () => {
    vi.mocked(Project.findById).mockResolvedValue({
      createdBy: 'other-user',
      organization: 'org-1',
      _id: 'p1',
    } as never);
    vi.mocked(OrganizationMember.exists).mockResolvedValue(null as never);
    vi.mocked(ProjectClient.exists).mockResolvedValue({ _id: 'row1' } as never);
    const req = { params: { projectId: 'p1' }, user: { sub: 'user-1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.isProjectOwner).toBe(false);
    expect(req.isProjectEditor).toBe(false);
  });

  it('deja pasar a un Asistente de Obra (miembro de la Empresa) como editor, sin ser dueño', async () => {
    vi.mocked(Project.findById).mockResolvedValue({
      createdBy: 'other-user',
      organization: 'org-1',
      _id: 'p1',
    } as never);
    vi.mocked(OrganizationMember.exists).mockResolvedValue({ _id: 'member-row' } as never);
    const req = { params: { projectId: 'p1' }, user: { sub: 'user-1' } } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(req, res, next);

    expect(OrganizationMember.exists).toHaveBeenCalledWith({
      organization: 'org-1',
      user: 'user-1',
      role: 'member',
    });
    expect(next).toHaveBeenCalled();
    expect(req.isProjectOwner).toBe(false);
    expect(req.isProjectEditor).toBe(true);
    // Ya es editor por ser Asistente — no hace falta ir a buscar ProjectClient.
    expect(ProjectClient.exists).not.toHaveBeenCalled();
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

describe('requireProjectEditor', () => {
  it('403 si no es dueño ni asistente', () => {
    const req = { isProjectEditor: false } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireProjectEditor(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar a un editor (dueño o asistente)', () => {
    const req = { isProjectEditor: true } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireProjectEditor(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
