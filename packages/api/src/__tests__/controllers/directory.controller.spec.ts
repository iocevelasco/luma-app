import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

/**
 * Cubre lo que importa del directorio compartido: sacar a alguien de una obra
 * donde ya trabaja no se deja, y lo del dueño de la Empresa no cruza a otra.
 */
vi.mock('../../models/Provider.js', () => ({ Provider: { findOne: vi.fn(), find: vi.fn() } }));
vi.mock('../../models/CrewMember.js', () => ({ CrewMember: { findOne: vi.fn(), find: vi.fn() } }));
vi.mock('../../models/ProjectProvider.js', () => ({
  ProjectProvider: { findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(), insertMany: vi.fn() },
}));
vi.mock('../../models/ProjectCrewMember.js', () => ({
  ProjectCrewMember: { findOne: vi.fn(), find: vi.fn(), updateOne: vi.fn(), insertMany: vi.fn() },
}));
vi.mock('../../models/Project.js', () => ({ Project: { find: vi.fn(), findById: vi.fn() } }));
vi.mock('../../models/Activity.js', () => ({ Activity: { find: vi.fn() } }));
vi.mock('../../models/ActivityProvider.js', () => ({ ActivityProvider: { exists: vi.fn() } }));
vi.mock('../../models/ActivityCrew.js', () => ({ ActivityCrew: { exists: vi.fn() } }));
vi.mock('../../models/ProviderEngagement.js', () => ({ ProviderEngagement: { exists: vi.fn() } }));
vi.mock('../../models/Expense.js', () => ({ Expense: { exists: vi.fn() } }));
vi.mock('../../models/LaborRecord.js', () => ({ LaborRecord: { exists: vi.fn() } }));
vi.mock('../../models/CrewGoal.js', () => ({ CrewGoal: { exists: vi.fn() } }));
vi.mock('../../services/organization.service.js', () => ({
  findMyOrganizationId: vi.fn(),
}));

const { ProjectProvider } = await import('../../models/ProjectProvider.js');
const { Activity } = await import('../../models/Activity.js');
const { ActivityProvider } = await import('../../models/ActivityProvider.js');
const { ProviderEngagement } = await import('../../models/ProviderEngagement.js');
const { Expense } = await import('../../models/Expense.js');
const { Project } = await import('../../models/Project.js');
const { Provider } = await import('../../models/Provider.js');
const { findMyOrganizationId } = await import('../../services/organization.service.js');
const { removeProviderFromProject, setOrganizationProviderProjects } = await import(
  '../../controllers/directory.controller.js'
);

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

/** Los handlers son async y reportan por `next`: espera a que uno de los dos responda. */
function run(
  handler: (req: Request, res: Response, next: NextFunction) => void,
  req: Partial<Request>,
) {
  return new Promise<{ res: Response; error?: { code: string } }>((resolve) => {
    const res = mockRes();
    (res.json as ReturnType<typeof vi.fn>).mockImplementation(() => {
      resolve({ res });
      return res;
    });
    handler(req as Request, res, ((error: { code: string }) => resolve({ res, error })) as NextFunction);
  });
}

const project = { _id: 'project-1', organization: 'org-1' };

describe('removeProviderFromProject', () => {
  beforeEach(() => vi.clearAllMocks());

  it('409 si el proveedor ya tiene actividades en la obra', async () => {
    const deleteOne = vi.fn();
    vi.mocked(ProjectProvider.findOne).mockResolvedValue({ deleteOne } as never);
    vi.mocked(Activity.find).mockReturnValue({ distinct: vi.fn().mockResolvedValue(['a1']) } as never);
    vi.mocked(ActivityProvider.exists).mockResolvedValue({ _id: 'x' } as never);
    vi.mocked(ProviderEngagement.exists).mockResolvedValue(null as never);
    vi.mocked(Expense.exists).mockResolvedValue(null as never);

    const { error } = await run(removeProviderFromProject, {
      project,
      params: { providerId: 'provider-1' },
    } as never);

    expect(error?.code).toBe('CONFLICT');
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('lo saca cuando no tiene nada asignado', async () => {
    const deleteOne = vi.fn().mockResolvedValue(undefined);
    vi.mocked(ProjectProvider.findOne).mockResolvedValue({ deleteOne } as never);
    vi.mocked(Activity.find).mockReturnValue({ distinct: vi.fn().mockResolvedValue([]) } as never);
    vi.mocked(ActivityProvider.exists).mockResolvedValue(null as never);
    vi.mocked(ProviderEngagement.exists).mockResolvedValue(null as never);
    vi.mocked(Expense.exists).mockResolvedValue(null as never);

    const { error } = await run(removeProviderFromProject, {
      project,
      params: { providerId: 'provider-1' },
    } as never);

    expect(error).toBeUndefined();
    expect(deleteOne).toHaveBeenCalled();
  });
});

describe('setOrganizationProviderProjects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('400 si una obra no es de la Empresa del dueño', async () => {
    vi.mocked(findMyOrganizationId).mockResolvedValue('org-1');
    vi.mocked(Provider.findOne).mockResolvedValue({ _id: 'provider-1', name: 'Pérez' } as never);
    // Se piden dos obras y sólo una es de la Empresa.
    vi.mocked(Project.find).mockResolvedValue([{ _id: 'p1' }] as never);

    const { error } = await run(setOrganizationProviderProjects, {
      user: { sub: 'user-1' },
      params: { providerId: 'provider-1' },
      body: { projectIds: ['p1', 'p-ajena'] },
    } as never);

    expect(error?.code).toBe('VALIDATION');
    expect(ProjectProvider.insertMany).not.toHaveBeenCalled();
  });
});
