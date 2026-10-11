import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no puede expresar Zod: el alcance del roster (Empresa + esta
 * obra), que una meta no se le pueda asignar a personal de otra Empresa, y
 * que la actividad vinculada sea de esta obra.
 */
vi.mock('../../models/CrewMember.js', () => ({
  CrewMember: { find: vi.fn(), create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../../models/CrewGoal.js', () => ({
  CrewGoal: { find: vi.fn(), create: vi.fn(), findOneAndUpdate: vi.fn(), findOneAndDelete: vi.fn() },
}));
vi.mock('../../models/Activity.js', () => ({ Activity: { findOne: vi.fn() } }));

const { CrewMember } = await import('../../models/CrewMember.js');
const { CrewGoal } = await import('../../models/CrewGoal.js');
const { Activity } = await import('../../models/Activity.js');
const { listCrewMembers, createCrewMember, createCrewGoal, listCrewGoals } = await import(
  '../../controllers/crew.controller.js'
);

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function jsonData(res: Response): { success: boolean; data?: unknown } {
  return (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

const project = { _id: 'project-1', organization: 'org-1' };

const baseMember = {
  _id: 'crew-1',
  organization: 'org-1',
  scope: 'organization',
  name: 'Juan Pérez',
  kind: 'persona',
  isLead: false,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('listCrewMembers — roster de la Empresa más el de esta obra', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filtra por alcance y sólo activos', async () => {
    vi.mocked(CrewMember.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([baseMember]),
    } as never);
    const res = mockRes();

    await listCrewMembers({ project } as unknown as Request, res);

    expect(CrewMember.find).toHaveBeenCalledWith({
      organization: 'org-1',
      $or: [{ scope: { $ne: 'project' } }, { project: 'project-1' }],
      active: true,
    });
    expect(jsonData(res)).toMatchObject({ data: { crewMembers: [{ id: 'crew-1' }] } });
  });
});

describe('createCrewMember', () => {
  beforeEach(() => vi.clearAllMocks());

  it('el de la Empresa no queda atado a una obra', async () => {
    vi.mocked(CrewMember.create).mockResolvedValue(baseMember as never);
    const req = { project, body: { name: 'Juan Pérez' } } as unknown as Request;
    const res = mockRes();

    await createCrewMember(req, res);

    expect(CrewMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ organization: 'org-1', project: null }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('el contratado para esta obra queda atado a ella', async () => {
    vi.mocked(CrewMember.create).mockResolvedValue(baseMember as never);
    const req = {
      project,
      body: { name: 'Cuadrilla temporal', kind: 'equipo', scope: 'project' },
    } as unknown as Request;
    const res = mockRes();

    await createCrewMember(req, res);

    expect(CrewMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'project', project: 'project-1' }),
    );
  });

  it('400 sin nombre', async () => {
    const res = mockRes();

    await createCrewMember({ project, body: { name: '' } } as unknown as Request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CrewMember.create).not.toHaveBeenCalled();
  });
});

describe('createCrewGoal — pertenencia cruzada', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockReq(body: Record<string, unknown>): Request {
    return {
      user: { sub: 'user-1' },
      project,
      body: { crewMemberId: 'crew-1', weekStart: '2026-09-28', description: 'Revoque', ...body },
    } as unknown as Request;
  }

  it('404 si el personal no es visible desde esta obra', async () => {
    vi.mocked(CrewMember.findOne).mockResolvedValue(null);
    const res = mockRes();

    await createCrewGoal(mockReq({}), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(CrewGoal.create).not.toHaveBeenCalled();
  });

  it('400 si la actividad vinculada es de otra obra', async () => {
    vi.mocked(CrewMember.findOne).mockResolvedValue(baseMember as never);
    vi.mocked(Activity.findOne).mockResolvedValue(null);
    const res = mockRes();

    await createCrewGoal(mockReq({ activityId: 'de-otra-obra' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(CrewGoal.create).not.toHaveBeenCalled();
  });

  it('crea la meta pendiente cuando todo pertenece a la obra', async () => {
    vi.mocked(CrewMember.findOne).mockResolvedValue(baseMember as never);
    vi.mocked(CrewGoal.create).mockResolvedValue({
      _id: 'goal-1',
      project: 'project-1',
      crewMember: 'crew-1',
      weekStart: '2026-09-28',
      description: 'Revoque',
      status: 'pendiente',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const res = mockRes();

    await createCrewGoal(mockReq({}), res);

    expect(CrewGoal.create).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'project-1', crewMember: 'crew-1', status: 'pendiente' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('listCrewGoals', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockFind(goals: unknown[]) {
    vi.mocked(CrewGoal.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({ populate: vi.fn().mockResolvedValue(goals) }),
    } as never);
  }

  it('filtra por semana cuando viene el query param', async () => {
    mockFind([]);
    const res = mockRes();

    await listCrewGoals(
      { project, query: { weekStart: '2026-09-28' } } as unknown as Request,
      res,
    );

    expect(CrewGoal.find).toHaveBeenCalledWith({
      project: 'project-1',
      weekStart: '2026-09-28',
    });
  });

  it('sin query param trae todas las de la obra', async () => {
    mockFind([]);
    const res = mockRes();

    await listCrewGoals({ project, query: {} } as unknown as Request, res);

    expect(CrewGoal.find).toHaveBeenCalledWith({ project: 'project-1' });
  });

  it('resuelve el nombre de quien tiene la meta', async () => {
    mockFind([
      {
        _id: 'goal-1',
        project: 'project-1',
        weekStart: '2026-09-28',
        description: 'Revoque',
        status: 'pendiente',
        crewMember: { _id: 'crew-1', name: 'Juan Pérez', kind: 'persona' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const res = mockRes();

    await listCrewGoals({ project, query: {} } as unknown as Request, res);

    expect(jsonData(res)).toMatchObject({
      data: { goals: [{ crewMemberName: 'Juan Pérez', crewMemberKind: 'persona' }] },
    });
  });
});
