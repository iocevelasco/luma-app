import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * La regla central del flujo de validación: el Asistente reporta terminado
 * (`en_revision`) pero NO puede cerrar; cerrar a `completada` es del dueño.
 * Y devolver el trabajo exige motivo, para que no quede en limbo.
 */
vi.mock('../../models/Activity.js', () => ({
  Activity: { findOne: vi.fn(), findOneAndUpdate: vi.fn(), findByIdAndDelete: vi.fn() },
}));
vi.mock('../../models/MaterialItem.js', () => ({ MaterialItem: { updateMany: vi.fn() } }));
vi.mock('../../services/storage.service.js', () => ({
  StorageNotConfiguredError: class extends Error {},
  deleteEvidencePhoto: vi.fn(),
  signEvidencePhotoUrl: vi.fn().mockResolvedValue(null),
  uploadEvidencePhoto: vi.fn(),
}));

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

describe('updateActivity — cerrar es del supervisor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('403 si el Asistente intenta marcar completada', async () => {
    const req = {
      user: { sub: 'assistant-1' },
      project: { _id: 'project-1' },
      isProjectOwner: false,
      params: { activityId: 'activity-1' },
      body: { status: 'completada' },
    } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(Activity.findOne).not.toHaveBeenCalled();
  });

  it('el Asistente sí puede reportar terminado (en_revision)', async () => {
    const activity = mockActivity();
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    const req = {
      user: { sub: 'assistant-1' },
      project: { _id: 'project-1' },
      isProjectOwner: false,
      params: { activityId: 'activity-1' },
      body: { status: 'en_revision' },
    } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(activity.set).toHaveBeenCalledWith(
      'review',
      expect.objectContaining({ reportedBy: 'assistant-1' }),
    );
    expect(activity.save).toHaveBeenCalled();
  });

  it('el dueño cierra y queda registrado quién aprobó', async () => {
    const activity = mockActivity({
      status: 'en_revision',
      review: { reportedBy: 'assistant-1', reportedAt: new Date() },
    });
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    const req = {
      user: { sub: 'owner-1' },
      project: { _id: 'project-1' },
      isProjectOwner: true,
      params: { activityId: 'activity-1' },
      body: { status: 'completada' },
    } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(activity.set).toHaveBeenCalledWith('review.approvedBy', 'owner-1');
    expect(activity.save).toHaveBeenCalled();
  });

  it('editar otros campos no necesita ser dueño', async () => {
    const activity = mockActivity();
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    const req = {
      user: { sub: 'assistant-1' },
      project: { _id: 'project-1' },
      isProjectOwner: false,
      params: { activityId: 'activity-1' },
      body: { notes: 'Se retrasó por lluvia', specialty: 'albanileria' },
    } as unknown as Request;
    const res = mockRes();

    await updateActivity(req, res);

    expect(activity.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
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
