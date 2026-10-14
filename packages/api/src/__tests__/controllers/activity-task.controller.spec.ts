import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canInProject, type Capability, type ProjectRole } from '@luma/shared';
import type { Request, Response } from 'express';

/**
 * Una tarea es una actividad: la misma entidad para el Cronograma y el
 * Tablero. Lo que fija este spec es el reparto que se decidió con producto:
 *
 * - el supervisor CREA tareas, y pueden nacer con su cuadrilla (que es lo
 *   que las lleva a la Jornada);
 * - modificarlas —incluido cancelar y restaurar— es del gerente.
 */
vi.mock('../../models/Activity.js', () => ({
  Activity: { create: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../../models/ActivityCrew.js', () => ({ ActivityCrew: { insertMany: vi.fn() } }));
vi.mock('../../models/CrewMember.js', () => ({ CrewMember: { find: vi.fn() } }));
vi.mock('../../models/MaterialItem.js', () => ({ MaterialItem: { updateMany: vi.fn() } }));
vi.mock('../../services/directory.service.js', () => ({
  visibleCrewFilter: vi.fn(async () => ({ organization: 'org-1' })),
}));
vi.mock('../../services/notification.service.js', () => ({ notifyProject: vi.fn() }));
vi.mock('../../services/storage.service.js', () => ({
  StorageNotConfiguredError: class extends Error {},
  deleteEvidencePhoto: vi.fn(),
  signEvidencePhotoUrl: vi.fn().mockResolvedValue(null),
  uploadEvidencePhoto: vi.fn(),
}));

const { Activity } = await import('../../models/Activity.js');
const { ActivityCrew } = await import('../../models/ActivityCrew.js');
const { CrewMember } = await import('../../models/CrewMember.js');
const { createActivity, updateActivity } = await import(
  '../../controllers/activity.controller.js'
);

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

/** `can` contra la grilla real: si un permiso cambia, este test lo nota. */
function canFor(role: ProjectRole) {
  return (capability: Capability) =>
    canInProject(role, capability, { providersVisibleToClient: false });
}

const project = { _id: 'project-1', organization: 'org-1' };

function activityDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'activity-1',
    project: 'project-1',
    name: 'Limpiar el obrador',
    specialty: 'otra',
    startDate: '2026-10-13',
    endDate: '2026-10-13',
    responsible: { name: 'Ana' },
    status: 'pendiente',
    evidence: [],
    review: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    set: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const validTask = {
  name: 'Limpiar el obrador',
  specialty: 'otra',
  startDate: '2026-10-13',
  endDate: '2026-10-13',
  responsible: { name: 'Ana' },
};

describe('createActivity — la tarea nace con su cuadrilla', () => {
  beforeEach(() => vi.clearAllMocks());

  function create(body: Record<string, unknown>) {
    const res = mockRes();
    return createActivity(
      { user: { sub: 'user-1' }, project, body } as unknown as Request,
      res,
    ).then(() => res);
  }

  it('crea la tarea y la cuadrilla con la que nace', async () => {
    vi.mocked(CrewMember.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([{ _id: 'crew-1' }]),
    } as never);
    vi.mocked(Activity.create).mockResolvedValue(activityDoc() as never);

    const res = await create({ ...validTask, crewMemberIds: ['crew-1', 'crew-1'] });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Activity.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ crewMemberIds: expect.anything() }),
    );
    // El id repetido entra una sola vez.
    expect(ActivityCrew.insertMany).toHaveBeenCalledWith([
      { activity: 'activity-1', crewMember: 'crew-1' },
    ]);
  });

  it('400 si alguien de la cuadrilla no está en esta obra, y no crea nada', async () => {
    vi.mocked(CrewMember.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as never);

    const res = await create({ ...validTask, crewMemberIds: ['de-otra-obra'] });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Activity.create).not.toHaveBeenCalled();
    expect(ActivityCrew.insertMany).not.toHaveBeenCalled();
  });

  it('sin cuadrilla no toca ActivityCrew', async () => {
    vi.mocked(Activity.create).mockResolvedValue(activityDoc() as never);

    await create(validTask);

    expect(CrewMember.find).not.toHaveBeenCalled();
    expect(ActivityCrew.insertMany).not.toHaveBeenCalled();
  });
});

describe('updateActivity — el supervisor mueve, el gerente modifica', () => {
  beforeEach(() => vi.clearAllMocks());

  function update(role: ProjectRole, body: Record<string, unknown>) {
    const res = mockRes();
    return updateActivity(
      {
        user: { sub: 'user-1' },
        project,
        params: { activityId: 'activity-1' },
        body,
        can: canFor(role),
      } as unknown as Request,
      res,
    ).then(() => res);
  }

  it('el supervisor la mueve por el flujo', async () => {
    const doc = activityDoc();
    vi.mocked(Activity.findOne).mockResolvedValue(doc as never);

    const res = await update('supervisor', { status: 'en_curso' });

    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(doc.save).toHaveBeenCalled();
  });

  it('el supervisor no la modifica', async () => {
    const res = await update('supervisor', { endDate: '2026-10-20' });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(Activity.findOne).not.toHaveBeenCalled();
  });

  it('el supervisor no la cancela: cancelar es una decisión de planificación', async () => {
    const res = await update('supervisor', { status: 'cancelada' });
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('el supervisor no restaura una cancelada', async () => {
    const doc = activityDoc({ status: 'cancelada' });
    vi.mocked(Activity.findOne).mockResolvedValue(doc as never);

    const res = await update('supervisor', { status: 'pendiente' });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('el supervisor no reabre una completada: deshace la aprobación del gerente', async () => {
    const doc = activityDoc({ status: 'completada' });
    vi.mocked(Activity.findOne).mockResolvedValue(doc as never);

    const res = await update('supervisor', { status: 'en_curso' });

    expect(res.status).toHaveBeenCalledWith(403);
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('el gerente cancela y restaura', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue(activityDoc() as never);
    expect((await update('gerente', { status: 'cancelada' })).status).not.toHaveBeenCalledWith(
      403,
    );

    const cancelled = activityDoc({ status: 'cancelada' });
    vi.mocked(Activity.findOne).mockResolvedValue(cancelled as never);
    await update('gerente', { status: 'pendiente' });
    expect(cancelled.save).toHaveBeenCalled();
  });
});
