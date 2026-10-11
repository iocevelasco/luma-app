import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canInProject, type Capability, type ProjectRole } from '@luma/shared';
import type { Request, Response } from 'express';

/**
 * La regla central del flujo de validación: el Asistente reporta terminado
 * (`en_revision`) pero NO puede cerrar; cerrar a `completada` es del dueño.
 * Y devolver el trabajo exige motivo, para que no quede en limbo.
 */
vi.mock('../../models/Activity.js', () => ({
  Activity: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), findByIdAndDelete: vi.fn() },
}));
vi.mock('../../services/notification.service.js', () => ({
  notifyProject: vi.fn(),
}));
vi.mock('../../models/MaterialItem.js', () => ({ MaterialItem: { updateMany: vi.fn() } }));
vi.mock('../../services/storage.service.js', () => ({
  StorageNotConfiguredError: class extends Error {},
  deleteEvidencePhoto: vi.fn(),
  signEvidencePhotoUrl: vi.fn().mockResolvedValue(null),
  uploadEvidencePhoto: vi.fn(),
}));

const { notifyProject } = await import('../../services/notification.service.js');
const { Activity } = await import('../../models/Activity.js');
const { updateActivity, rejectActivity } = await import(
  '../../controllers/activity.controller.js'
);

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function jsonBody(res: Response): { success: boolean; error?: string } {
  return (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

/** Documento con `set`/`save` espiables y el shape mínimo del DTO. */
function mockActivity(overrides: Record<string, unknown> = {}) {
  const doc: Record<string, unknown> = {
    _id: 'activity-1',
    project: 'project-1',
    name: 'Revoque',
    area: 'Planta alta',
    startDate: '2026-09-01',
    endDate: '2026-09-05',
    responsible: { name: 'Juan' },
    status: 'en_curso',
    evidence: [],
    review: null,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    set: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return doc;
}

/**
 * `can` armado contra la grilla real de `@luma/shared`, no un booleano a mano:
 * si un permiso cambia en la grilla, este test lo nota.
 */
function canFor(role: ProjectRole) {
  return (capability: Capability) =>
    canInProject(role, capability, { providersVisibleToClient: false });
}

describe('updateActivity — reportar es del supervisor, cerrar del gerente', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403 si el supervisor intenta marcar completada', async () => {
    const req = {
      user: { sub: 'supervisor-1' },
      project: { _id: 'project-1' },
      can: canFor('supervisor'),
      params: { activityId: 'activity-1' },
      body: { status: 'completada' },
    } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Activity.findOne).not.toHaveBeenCalled();
  });

  it('el supervisor sí puede reportar terminado (en_revision)', async () => {
    const activity = mockActivity();
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    const req = {
      user: { sub: 'supervisor-1' },
      project: { _id: 'project-1' },
      can: canFor('supervisor'),
      params: { activityId: 'activity-1' },
      body: { status: 'en_revision' },
    } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(activity.set).toHaveBeenCalledWith(
      'review',
      expect.objectContaining({ reportedBy: 'supervisor-1' }),
    );
    expect(activity.save).toHaveBeenCalled();
  });

  it('el gerente cierra y queda registrado quién aprobó', async () => {
    const activity = mockActivity({
      status: 'en_revision',
      review: { reportedBy: 'supervisor-1', reportedAt: new Date() },
    });
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    const req = {
      user: { sub: 'owner-1' },
      project: { _id: 'project-1' },
      can: canFor('gerente'),
      params: { activityId: 'activity-1' },
      body: { status: 'completada' },
    } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(activity.set).toHaveBeenCalledWith('review.approvedBy', 'owner-1');
    expect(activity.save).toHaveBeenCalled();
  });

  it('el supervisor anota novedades sin ser gerente', async () => {
    const activity = mockActivity();
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    const req = {
      user: { sub: 'supervisor-1' },
      project: { _id: 'project-1' },
      can: canFor('supervisor'),
      params: { activityId: 'activity-1' },
      // `notes` y `status` son reporte. `specialty` sería replanificar — ver
      // el test de abajo.
      body: { notes: 'Se retrasó por lluvia' },
    } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(activity.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
  });

  it('el supervisor no puede replanificar: fechas, alcance ni responsable', async () => {
    // La matriz le da "cargar planificación de obra" al gerente y al
    // supervisor sólo "reportar avance". Mover una fecha de entrega no es
    // reportar.
    for (const body of [
      { endDate: '2026-12-31' },
      { name: 'Otra cosa' },
      { responsible: { name: 'Otro' } },
      { specialty: 'albanileria' },
    ]) {
      vi.clearAllMocks();
      const req = {
        user: { sub: 'supervisor-1' },
        project: { _id: 'project-1' },
        can: canFor('supervisor'),
        params: { activityId: 'activity-1' },
        body,
      } as unknown as Request;
      const res = mockRes();

      await updateActivity(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(Activity.findOne).not.toHaveBeenCalled();
    }
  });
});

describe('rejectActivity — devolver el trabajo con motivo', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockReq(body: unknown, activityOverrides: Record<string, unknown> = {}): Request {
    const activity = mockActivity({ status: 'en_revision', ...activityOverrides });
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    return {
      user: { sub: 'owner-1' },
      project: { _id: 'project-1' },
      params: { activityId: 'activity-1' },
      body,
      // Se expone para que el test pueda revisar `set`/`save`.
      __activity: activity,
    } as unknown as Request;
  }

  it('400 sin motivo: un rechazo mudo deja la actividad en limbo', async () => {
    const res = mockRes();

    await rejectActivity(mockReq({ reason: '   ' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('devuelve a en_curso y guarda el motivo', async () => {
    const req = mockReq({ reason: 'Falta terminar el borde del zócalo' });
    const activity = (req as unknown as { __activity: ReturnType<typeof mockActivity> }).__activity;
    const res = mockRes();

    await rejectActivity(req, res);

    expect(activity.set).toHaveBeenCalledWith('status', 'en_curso');
    expect(activity.set).toHaveBeenCalledWith(
      'review.rejectionReason',
      'Falta terminar el borde del zócalo',
    );
    expect(activity.save).toHaveBeenCalled();
  });

  it('400 si la actividad no está en revisión', async () => {
    const res = mockRes();

    await rejectActivity(mockReq({ reason: 'No está' }, { status: 'en_curso' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonBody(res).error).toMatch(/revisión/i);
  });
});

describe('avisos por cambio de estado', () => {
  beforeEach(() => vi.clearAllMocks());

  it('arrancar una actividad le avisa al cliente', async () => {
    // "Recibir notificaciones de actividad iniciada" — fila del cliente.
    const activity = mockActivity({ status: 'pendiente' });
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);

    await updateActivity(
      {
        user: { sub: 'gerente-1' },
        project: { _id: 'project-1' },
        can: canFor('gerente'),
        params: { activityId: 'activity-1' },
        body: { status: 'en_curso' },
      } as unknown as Request,
      mockRes(),
    );

    const call = vi.mocked(notifyProject).mock.calls[0][0];
    expect(call.type).toBe('actividad_iniciada');
    expect(call.audience).toContain('cliente');
  });

  it('reportar terminado avisa sólo al gerente, no al cliente', async () => {
    // `en_revision` puede volver atrás: anunciarlo como avance al cliente
    // sería anunciar algo que todavía no pasó.
    const activity = mockActivity({ status: 'en_curso' });
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);

    await updateActivity(
      {
        user: { sub: 'supervisor-1' },
        project: { _id: 'project-1' },
        can: canFor('supervisor'),
        params: { activityId: 'activity-1' },
        body: { status: 'en_revision' },
      } as unknown as Request,
      mockRes(),
    );

    const call = vi.mocked(notifyProject).mock.calls[0][0];
    expect(call.type).toBe('actividad_en_revision');
    expect(call.audience).toEqual(['gerente']);
  });

  it('no avisa si el estado no cambió', async () => {
    const activity = mockActivity({ status: 'en_curso' });
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);

    await updateActivity(
      {
        user: { sub: 'supervisor-1' },
        project: { _id: 'project-1' },
        can: canFor('supervisor'),
        params: { activityId: 'activity-1' },
        body: { status: 'en_curso', notes: 'Sigue igual' },
      } as unknown as Request,
      mockRes(),
    );

    expect(notifyProject).not.toHaveBeenCalled();
  });

  it('editar sin tocar el estado no avisa nada', async () => {
    const activity = mockActivity({ status: 'en_curso' });
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);

    await updateActivity(
      {
        user: { sub: 'supervisor-1' },
        project: { _id: 'project-1' },
        can: canFor('supervisor'),
        params: { activityId: 'activity-1' },
        body: { notes: 'Llovió' },
      } as unknown as Request,
      mockRes(),
    );

    expect(notifyProject).not.toHaveBeenCalled();
  });
});
