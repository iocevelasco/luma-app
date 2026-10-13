import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no puede expresar Zod: el alcance del roster (Empresa + esta
 * obra), que una meta no se le pueda asignar a personal de otra Empresa, y
 * que la actividad vinculada sea de esta obra.
 */
vi.mock('../../services/directory.service.js', () => ({
  visibleProviderFilter: vi.fn(async (project: { _id: string; organization: string }) => ({
    organization: project.organization,
    $or: [{ project: project._id }, { _id: { $in: ['assigned-1'] } }],
  })),
  visibleCrewFilter: vi.fn(async (project: { _id: string; organization: string }) => ({
    organization: project.organization,
    $or: [{ project: project._id }, { _id: { $in: ['assigned-1'] } }],
  })),
}));
vi.mock('../../models/ProjectProvider.js', () => ({
  ProjectProvider: { create: vi.fn(), find: vi.fn() },
}));
vi.mock('../../models/ProjectCrewMember.js', () => ({
  ProjectCrewMember: { create: vi.fn(), find: vi.fn() },
}));
// El guardia se prueba en su propio spec: acá sólo importa que se lo llame.
vi.mock('../../services/crew-identity.service.js', () => ({
  assertNoCrewDuplicate: vi.fn(),
}));
vi.mock('../../models/CrewMember.js', () => ({
  CrewMember: { find: vi.fn(), create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../../models/CrewGoal.js', () => ({
  CrewGoal: {
    find: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
}));
vi.mock('../../models/Activity.js', () => ({ Activity: { findOne: vi.fn() } }));

const { CrewMember } = await import('../../models/CrewMember.js');
const { CrewGoal } = await import('../../models/CrewGoal.js');
const { Activity } = await import('../../models/Activity.js');
const { ProjectCrewMember } = await import('../../models/ProjectCrewMember.js');
const { assertNoCrewDuplicate } = await import('../../services/crew-identity.service.js');
const { conflict } = await import('../../utils/errors.js');
const { listCrewMembers, createCrewMember, createCrewGoal, listCrewGoals, updateCrewGoal } =
  await import('../../controllers/crew.controller.js');

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
      $or: [{ project: 'project-1' }, { _id: { $in: ['assigned-1'] } }],
      active: true,
    });
    expect(jsonData(res)).toMatchObject({ data: { crewMembers: [{ id: 'crew-1' }] } });
  });
});

describe('createCrewMember — todo alta va a la Empresa y queda en la obra', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockReq(body: Record<string, unknown>, canSeeMoney = false): Request {
    return {
      project,
      body,
      can: (capability: string) => canSeeMoney && capability === 'expense.read',
    } as unknown as Request;
  }

  it('crea en la libreta de la Empresa y lo asigna a esta obra', async () => {
    vi.mocked(CrewMember.create).mockResolvedValue(baseMember as never);
    const res = mockRes();
    const next = vi.fn();

    await createCrewMember(mockReq({ name: 'Juan Pérez' }), res, next);

    expect(CrewMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ organization: 'org-1', scope: 'organization', project: null }),
    );
    expect(ProjectCrewMember.create).toHaveBeenCalledWith({
      project: 'project-1',
      crewMember: 'crew-1',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('ignora "sólo para esta obra": ese alcance ya no existe', async () => {
    vi.mocked(CrewMember.create).mockResolvedValue(baseMember as never);
    const res = mockRes();

    await createCrewMember(
      mockReq({ name: 'Cuadrilla temporal', kind: 'equipo', scope: 'project' }),
      res,
      vi.fn(),
    );

    expect(CrewMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'organization', project: null }),
    );
  });

  it('pasa por el guardia de duplicados con lo que identifica a la persona', async () => {
    vi.mocked(CrewMember.create).mockResolvedValue(baseMember as never);

    await createCrewMember(
      mockReq({ name: 'Juan Pérez', phone: '11 5555 5555', allowDuplicateName: true }),
      mockRes(),
      vi.fn(),
    );

    expect(assertNoCrewDuplicate).toHaveBeenCalledWith(
      'org-1',
      { name: 'Juan Pérez', phone: '11 5555 5555', kind: 'persona', allowDuplicateName: true },
      'project-1',
    );
  });

  it('si ya está en la Empresa no crea nada y pasa el 409 al errorHandler', async () => {
    vi.mocked(assertNoCrewDuplicate).mockRejectedValueOnce(conflict('Ya existe', { reason: 'name' }));
    const next = vi.fn();

    await createCrewMember(mockReq({ name: 'Juan Pérez' }), mockRes(), next);

    expect(CrewMember.create).not.toHaveBeenCalled();
    expect(ProjectCrewMember.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }));
  });

  it('el jornal sólo se guarda si quien carga puede ver gastos', async () => {
    vi.mocked(CrewMember.create).mockResolvedValue(baseMember as never);

    await createCrewMember(mockReq({ name: 'Juan', dailyRate: 5000 }, false), mockRes(), vi.fn());
    expect(CrewMember.create).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ dailyRate: expect.anything() }),
    );

    await createCrewMember(mockReq({ name: 'Juan', dailyRate: 5000 }, true), mockRes(), vi.fn());
    expect(CrewMember.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ dailyRate: 5000 }),
    );
  });

  it('400 sin nombre', async () => {
    const next = vi.fn();

    await createCrewMember(mockReq({ name: '' }), mockRes(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION' }));
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

  it('una meta que nace hecha nace con su fecha de cierre', async () => {
    vi.mocked(CrewMember.findOne).mockResolvedValue(baseMember as never);
    vi.mocked(CrewGoal.create).mockResolvedValue({
      _id: 'goal-1',
      project: 'project-1',
      crewMember: 'crew-1',
      weekStart: '2026-09-28',
      description: 'Revoque',
      status: 'done',
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    await createCrewGoal(mockReq({ status: 'done' }), mockRes());

    expect(CrewGoal.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'done', completedAt: expect.any(Date) }),
    );
  });

  it('crea la meta pendiente cuando todo pertenece a la obra', async () => {
    vi.mocked(CrewMember.findOne).mockResolvedValue(baseMember as never);
    vi.mocked(CrewGoal.create).mockResolvedValue({
      _id: 'goal-1',
      project: 'project-1',
      crewMember: 'crew-1',
      weekStart: '2026-09-28',
      description: 'Revoque',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const res = mockRes();

    await createCrewGoal(mockReq({}), res);

    expect(CrewGoal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        project: 'project-1',
        crewMember: 'crew-1',
        status: 'pending',
        completedAt: null,
      }),
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

  it('con includeCarried suma las pendientes de semanas anteriores', async () => {
    mockFind([]);
    const res = mockRes();

    await listCrewGoals(
      {
        project,
        query: { weekStart: '2026-10-12', includeCarried: 'true' },
      } as unknown as Request,
      res,
    );

    expect(CrewGoal.find).toHaveBeenCalledWith({
      project: 'project-1',
      $or: [
        { weekStart: '2026-10-12' },
        { weekStart: { $lt: '2026-10-12' }, status: { $in: ['pending', 'pendiente'] } },
        // Las arrastradas cerradas esta semana siguen a la vista y cuentan.
        {
          weekStart: { $lt: '2026-10-12' },
          status: 'done',
          completedAt: { $gte: new Date('2026-10-12T00:00:00') },
        },
      ],
    });
  });

  it('includeCarried sin semana no filtra: ya trae todas', async () => {
    mockFind([]);
    const res = mockRes();

    await listCrewGoals(
      { project, query: { includeCarried: 'true' } } as unknown as Request,
      res,
    );

    expect(CrewGoal.find).toHaveBeenCalledWith({ project: 'project-1' });
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

describe('listCrewGoals — shim de estados viejos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('traduce un estado guardado en castellano al leer', async () => {
    vi.mocked(CrewGoal.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        populate: vi.fn().mockResolvedValue([
          {
            _id: 'goal-1',
            project: 'project-1',
            weekStart: '2026-09-28',
            description: 'Revoque',
            status: 'cumplida',
            crewMember: { _id: 'crew-1', name: 'Juan Pérez', kind: 'persona' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
      }),
    } as never);
    const res = mockRes();

    await listCrewGoals({ project, query: {} } as unknown as Request, res);

    expect(jsonData(res)).toMatchObject({ data: { goals: [{ status: 'done' }] } });
  });
});

describe('updateCrewGoal — completedAt marca la transición a done', () => {
  beforeEach(() => vi.clearAllMocks());

  const savedGoal = {
    _id: 'goal-1',
    project: 'project-1',
    crewMember: 'crew-1',
    weekStart: '2026-09-28',
    description: 'Revoque',
    status: 'done',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function mockCurrent(status: string) {
    vi.mocked(CrewGoal.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue({ status }),
    } as never);
    vi.mocked(CrewGoal.findOneAndUpdate).mockResolvedValue(savedGoal as never);
  }

  function update(body: Record<string, unknown>) {
    return updateCrewGoal(
      { project, params: { goalId: 'goal-1' }, body } as unknown as Request,
      mockRes(),
    );
  }

  function lastUpdate(): Record<string, unknown> {
    return vi.mocked(CrewGoal.findOneAndUpdate).mock.calls[0][1] as Record<string, unknown>;
  }

  it('al pasar a done le pone la fecha', async () => {
    mockCurrent('pending');
    await update({ status: 'done' });
    expect(lastUpdate().completedAt).toBeInstanceOf(Date);
  });

  it('volver a mandar done no le cambia la fecha', async () => {
    mockCurrent('done');
    await update({ status: 'done' });
    expect(lastUpdate()).not.toHaveProperty('completedAt');
  });

  it('una meta vieja `cumplida` cuenta como hecha', async () => {
    mockCurrent('cumplida');
    await update({ status: 'done' });
    expect(lastUpdate()).not.toHaveProperty('completedAt');
  });

  it('reabrirla le borra la fecha', async () => {
    mockCurrent('done');
    await update({ status: 'pending' });
    expect(lastUpdate().completedAt).toBeNull();
  });

  it('editar sólo el texto no toca la fecha', async () => {
    mockCurrent('done');
    await update({ description: 'Revoque fino' });
    expect(lastUpdate()).not.toHaveProperty('completedAt');
  });
});
