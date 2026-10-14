import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no puede expresar Zod: el alcance del roster (Empresa + esta
 * obra) y el alta, que siempre va a la Empresa y pasa por el guardia de
 * duplicados.
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

const { CrewMember } = await import('../../models/CrewMember.js');
const { ProjectCrewMember } = await import('../../models/ProjectCrewMember.js');
const { assertNoCrewDuplicate } = await import('../../services/crew-identity.service.js');
const { conflict } = await import('../../utils/errors.js');
const { listCrewMembers, createCrewMember } = await import(
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

