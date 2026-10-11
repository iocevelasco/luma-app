import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canInProject, type Capability, type ProjectRole } from '@luma/shared';
import type { Request, Response } from 'express';

/**
 * El nudo de este controller es la audiencia: el supervisor reporta hacia
 * adentro y el gerente publica hacia el cliente. Esa regla no se puede
 * expresar en el router porque depende del body, así que acá es donde tiene
 * que estar probada.
 */
vi.mock('../../models/Milestone.js', () => ({
  Milestone: { find: vi.fn(), findOne: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
}));
vi.mock('../../models/Activity.js', () => ({
  Activity: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../../models/User.js', () => ({
  User: { find: vi.fn(), findById: vi.fn() },
}));
vi.mock('../../services/notification.service.js', () => ({
  notifyProject: vi.fn(),
}));

const { Milestone } = await import('../../models/Milestone.js');
const { Activity } = await import('../../models/Activity.js');
const { User } = await import('../../models/User.js');
const { notifyProject } = await import('../../services/notification.service.js');
const { createMilestone, listMilestones, updateMilestone, deleteMilestone } = await import(
  '../../controllers/milestone.controller.js'
);

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

/** `can` contra la grilla real: si un permiso cambia ahí, este test lo nota. */
function canFor(role: ProjectRole) {
  return (capability: Capability) =>
    canInProject(role, capability, { providersVisibleToClient: false });
}

const PROJECT = { _id: 'project-1', createdBy: 'gerente-1', providersVisibleToClient: false };

function reqFor(role: ProjectRole, body: Record<string, unknown> = {}, params = {}): Request {
  return {
    user: { sub: `${role}-1` },
    project: PROJECT,
    can: canFor(role),
    params,
    body,
  } as unknown as Request;
}

const VALID = {
  type: 'etapa_concluida',
  audience: 'cliente',
  title: 'Terminó la estructura',
  occurredOn: '2026-09-15',
};

function fakeMilestone(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'milestone-1',
    project: 'project-1',
    type: 'etapa_concluida',
    audience: 'cliente',
    severity: 'info',
    title: 'Terminó la estructura',
    description: undefined,
    occurredOn: '2026-09-15',
    activity: null,
    reportedBy: 'gerente-1',
    createdAt: new Date('2026-09-15T10:00:00.000Z'),
    updatedAt: new Date('2026-09-15T10:00:00.000Z'),
    set: vi.fn(),
    save: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(User.findById).mockReturnValue({
    select: vi.fn().mockResolvedValue({ _id: 'gerente-1', name: 'Gerente' }),
  } as never);
  vi.mocked(User.find).mockReturnValue({ select: vi.fn().mockResolvedValue([]) } as never);
});

describe('createMilestone', () => {
  it('el gerente publica un hito al cliente', async () => {
    vi.mocked(Milestone.create).mockResolvedValue(fakeMilestone() as never);
    const res = mockRes();

    await createMilestone(reqFor('gerente', VALID), res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('403 si el supervisor intenta publicar al cliente', async () => {
    // Su fila dice "notificar eventualidades SOLAMENTE al gerente".
    const res = mockRes();

    await createMilestone(reqFor('supervisor', VALID), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Milestone.create).not.toHaveBeenCalled();
  });

  it('el supervisor sí reporta una eventualidad interna', async () => {
    vi.mocked(Milestone.create).mockResolvedValue(
      fakeMilestone({ audience: 'interno', type: 'vicio_oculto' }) as never,
    );
    const res = mockRes();

    await createMilestone(
      reqFor('supervisor', { ...VALID, audience: 'interno', type: 'vicio_oculto' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('una eventualidad interna no llega al cliente', async () => {
    vi.mocked(Milestone.create).mockResolvedValue(
      fakeMilestone({ audience: 'interno' }) as never,
    );

    await createMilestone(reqFor('supervisor', { ...VALID, audience: 'interno' }), mockRes());

    const call = vi.mocked(notifyProject).mock.calls[0][0];
    expect(call.audience).not.toContain('cliente');
    expect(call.type).toBe('eventualidad');
  });

  it('un hito al cliente sí le llega', async () => {
    vi.mocked(Milestone.create).mockResolvedValue(fakeMilestone() as never);

    await createMilestone(reqFor('gerente', VALID), mockRes());

    const call = vi.mocked(notifyProject).mock.calls[0][0];
    expect(call.audience).toContain('cliente');
    expect(call.type).toBe('hito');
  });

  it('400 si la actividad enlazada es de otra obra', async () => {
    // Enlazarla filtraría su nombre a quien no tiene acceso a esa obra.
    vi.mocked(Activity.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as never);
    const res = mockRes();

    await createMilestone(reqFor('gerente', { ...VALID, activityId: 'activity-ajena' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Milestone.create).not.toHaveBeenCalled();
  });

  it('400 si falta la audiencia', async () => {
    // Sin default a propósito: un default de 'cliente' publicaría una
    // eventualidad interna por olvidarse de un campo.
    const { audience: _audience, ...sinAudiencia } = VALID;
    const res = mockRes();

    await createMilestone(reqFor('gerente', sinAudiencia), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('listMilestones', () => {
  function mockFind() {
    const sort = vi.fn().mockReturnThis();
    const limit = vi.fn().mockResolvedValue([]);
    vi.mocked(Milestone.find).mockReturnValue({ sort, limit } as never);
    return { sort, limit };
  }

  it('el cliente sólo ve los de audiencia cliente', async () => {
    mockFind();

    await listMilestones(reqFor('cliente'), mockRes());

    expect(Milestone.find).toHaveBeenCalledWith({ project: 'project-1', audience: 'cliente' });
  });

  it('gerente y supervisor ven todo, interno incluido', async () => {
    for (const role of ['gerente', 'supervisor'] as const) {
      vi.clearAllMocks();
      mockFind();

      await listMilestones(reqFor(role), mockRes());

      expect(Milestone.find).toHaveBeenCalledWith({ project: 'project-1' });
    }
  });
});

describe('updateMilestone y deleteMilestone', () => {
  it('el supervisor no puede editar un hito ya publicado al cliente', async () => {
    // Cambiarle el título a algo que el cliente ya recibió lo deja leyendo
    // otra cosa que la que le llegó.
    vi.mocked(Milestone.findOne).mockResolvedValue(fakeMilestone() as never);
    const res = mockRes();

    await updateMilestone(
      reqFor('supervisor', { title: 'Otro título' }, { milestoneId: 'milestone-1' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('el supervisor sí edita su propia eventualidad interna', async () => {
    const milestone = fakeMilestone({ audience: 'interno' });
    vi.mocked(Milestone.findOne).mockResolvedValue(milestone as never);
    const res = mockRes();

    await updateMilestone(
      reqFor('supervisor', { title: 'Otro título' }, { milestoneId: 'milestone-1' }),
      res,
    );

    expect(milestone.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('403 si el supervisor intenta cambiar la audiencia a cliente', async () => {
    const res = mockRes();

    await updateMilestone(
      reqFor('supervisor', { audience: 'cliente' }, { milestoneId: 'milestone-1' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Milestone.findOne).not.toHaveBeenCalled();
  });

  it('el supervisor no borra un hito publicado al cliente', async () => {
    vi.mocked(Milestone.findOne).mockResolvedValue(fakeMilestone() as never);
    const res = mockRes();

    await deleteMilestone(reqFor('supervisor', {}, { milestoneId: 'milestone-1' }), res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Milestone.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it('404 si el hito no es de esta obra', async () => {
    vi.mocked(Milestone.findOne).mockResolvedValue(null as never);
    const res = mockRes();

    await deleteMilestone(reqFor('gerente', {}, { milestoneId: 'otro' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
