import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

/**
 * El listado de obras trae, por cada una, el rol de quien pregunta y sus
 * capacidades ya resueltas: es lo que le permite a la Empresa saber en qué
 * obras puede dar acceso sin abrirlas una por una ni derivarlo del rol.
 */
vi.mock('../../models/User.js', () => ({ User: {} }));
vi.mock('../../models/Project.js', () => ({ Project: { find: vi.fn() } }));
vi.mock('../../models/ProjectMembership.js', () => ({ ProjectMembership: { find: vi.fn() } }));
vi.mock('../../services/organization.service.js', () => ({
  findMyOrganizationId: vi.fn(),
  createPersonalOrganization: vi.fn(),
}));
vi.mock('../../services/email.service.js', () => ({ EmailService: {} }));
vi.mock('../../controllers/auth.controller.js', () => ({
  ACTIVATION_TOKEN_TTL_MS: 1000,
  randomToken: () => 'token',
}));

const { Project } = await import('../../models/Project.js');
const { ProjectMembership } = await import('../../models/ProjectMembership.js');
const { listProjects } = await import('../../controllers/project.controller.js');

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function projectDoc(id: string, createdBy: string) {
  const date = new Date('2026-10-12T10:00:00.000Z');
  return {
    _id: id,
    organization: 'org-1',
    createdBy,
    name: `Obra ${id}`,
    description: 'x',
    location: 'CABA',
    estimatedStartDate: '2026-09-01',
    estimatedEndDate: '2026-12-01',
    currency: 'ARS',
    status: 'active',
    providersVisibleToClient: false,
    createdAt: date,
    updatedAt: date,
  };
}

describe('listProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marca gerente a quien creó la obra y le da project.invite', async () => {
    vi.mocked(ProjectMembership.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(Project.find).mockReturnValue({
      sort: () => ({ limit: () => Promise.resolve([projectDoc('p1', 'user-1')]) }),
    } as never);
    const res = mockRes();

    await listProjects({ user: { sub: 'user-1' } } as never, res);

    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { projects: { role: string; capabilities: string[] }[] };
    };
    expect(body.data.projects[0]!.role).toBe('gerente');
    expect(body.data.projects[0]!.capabilities).toContain('project.invite');
  });

  it('a un supervisor invitado le devuelve su rol y no le da project.invite', async () => {
    vi.mocked(ProjectMembership.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([{ project: 'p2', role: 'supervisor' }]),
    } as never);
    vi.mocked(Project.find).mockReturnValue({
      sort: () => ({ limit: () => Promise.resolve([projectDoc('p2', 'otro-usuario')]) }),
    } as never);
    const res = mockRes();

    await listProjects({ user: { sub: 'user-1' } } as never, res);

    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { projects: { role: string; capabilities: string[] }[] };
    };
    expect(body.data.projects[0]!.role).toBe('supervisor');
    expect(body.data.projects[0]!.capabilities).not.toContain('project.invite');
  });
});
