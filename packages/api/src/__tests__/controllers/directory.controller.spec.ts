import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

/**
 * Cubre lo que importa del directorio compartido: sacar a alguien de una obra
 * donde ya trabaja no se deja, y lo del dueño de la Empresa no cruza a otra.
 */
vi.mock('../../models/Provider.js', () => ({ Provider: { findOne: vi.fn(), find: vi.fn() } }));
vi.mock('../../models/CrewMember.js', () => ({
  CrewMember: { findOne: vi.fn(), find: vi.fn(), create: vi.fn() },
}));
vi.mock('../../services/crew-identity.service.js', () => ({
  assertNoCrewDuplicate: vi.fn(),
}));
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
const { CrewMember } = await import('../../models/CrewMember.js');
const { ProjectCrewMember } = await import('../../models/ProjectCrewMember.js');
const { findMyOrganizationId } = await import('../../services/organization.service.js');
const { assertNoCrewDuplicate } = await import('../../services/crew-identity.service.js');
const { conflict } = await import('../../utils/errors.js');
const {
  addCrewMemberToProject,
  createOrganizationCrewMember,
  listCrewDirectory,
  removeProviderFromProject,
  setOrganizationProviderProjects,
} = await import('../../controllers/directory.controller.js');

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

describe('addCrewMemberToProject — sumar a alguien que ya está en la Empresa', () => {
  beforeEach(() => vi.clearAllMocks());

  const crewMember = (active: boolean) => ({
    _id: 'crew-1',
    organization: 'org-1',
    scope: 'organization',
    name: 'Juan Pérez',
    kind: 'persona',
    isLead: false,
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
    save: vi.fn(),
  });

  function req(body: Record<string, unknown>, canManage: boolean) {
    return {
      project,
      params: { crewMemberId: 'crew-1' },
      body,
      can: (capability: string) => canManage && capability === 'crew.manage',
    } as never;
  }

  it('suma al activo sin más', async () => {
    vi.mocked(CrewMember.findOne).mockResolvedValue(crewMember(true) as never);

    const { res, error } = await run(addCrewMemberToProject, req({}, false));

    expect(error).toBeUndefined();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(ProjectCrewMember.updateOne).toHaveBeenCalled();
  });

  it('409 si está dado de baja y no se pidió reactivarlo', async () => {
    vi.mocked(CrewMember.findOne).mockResolvedValue(crewMember(false) as never);

    const { error } = await run(addCrewMemberToProject, req({}, true));

    expect(error?.code).toBe('CONFLICT');
    expect(ProjectCrewMember.updateOne).not.toHaveBeenCalled();
  });

  it('reactivar es del gerente: el supervisor recibe 403', async () => {
    const member = crewMember(false);
    vi.mocked(CrewMember.findOne).mockResolvedValue(member as never);

    const { error } = await run(addCrewMemberToProject, req({ reactivate: true }, false));

    expect(error?.code).toBe('FORBIDDEN');
    expect(member.save).not.toHaveBeenCalled();
  });

  it('el gerente lo reactiva y lo suma en un paso', async () => {
    const member = crewMember(false);
    vi.mocked(CrewMember.findOne).mockResolvedValue(member as never);

    const { res } = await run(addCrewMemberToProject, req({ reactivate: true }, true));

    expect(member.active).toBe(true);
    expect(member.save).toHaveBeenCalled();
    expect(ProjectCrewMember.updateOne).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('createOrganizationCrewMember — mismo guardia que desde la obra', () => {
  beforeEach(() => vi.clearAllMocks());

  it('si ya existe no crea y devuelve el 409', async () => {
    vi.mocked(findMyOrganizationId).mockResolvedValue('org-1' as never);
    vi.mocked(assertNoCrewDuplicate).mockRejectedValueOnce(conflict('Ya existe', { reason: 'name' }));

    const { error } = await run(createOrganizationCrewMember, {
      user: { sub: 'user-1' },
      body: { name: 'Juan Pérez' },
    } as never);

    expect(error?.code).toBe('CONFLICT');
    expect(CrewMember.create).not.toHaveBeenCalled();
  });

  it('consulta al guardia sin obra: desde la Empresa no hay "ya está acá"', async () => {
    vi.mocked(findMyOrganizationId).mockResolvedValue('org-1' as never);
    vi.mocked(CrewMember.create).mockResolvedValue({
      _id: 'crew-2',
      organization: 'org-1',
      scope: 'organization',
      name: 'María',
      kind: 'persona',
      isLead: false,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await run(createOrganizationCrewMember, {
      user: { sub: 'user-1' },
      body: { name: 'María', phone: '1155555555' },
    } as never);

    expect(assertNoCrewDuplicate).toHaveBeenCalledWith('org-1', {
      name: 'María',
      phone: '1155555555',
      kind: 'persona',
      allowDuplicateName: undefined,
    });
  });
});

describe('listCrewDirectory — ficha completa, sin plata', () => {
  beforeEach(() => vi.clearAllMocks());

  it('devuelve teléfono y notas (el supervisor ve todo del obrero) pero nunca el jornal', async () => {
    vi.mocked(ProjectCrewMember.find).mockReturnValue({
      distinct: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(CrewMember.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        {
          _id: 'crew-1',
          organization: 'org-1',
          scope: 'organization',
          name: 'Juan Pérez',
          kind: 'persona',
          isLead: false,
          phone: '11 5555 5555',
          notes: 'Trabajó en la obra de Palermo',
          dailyRate: 25000,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
    } as never);

    const { res } = await run(listCrewDirectory, { project } as never);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.data.crewMembers[0]).toMatchObject({
      id: 'crew-1',
      phone: '11 5555 5555',
      notes: 'Trabajó en la obra de Palermo',
    });
    expect(body.data.crewMembers[0]).not.toHaveProperty('dailyRate');
  });
});
