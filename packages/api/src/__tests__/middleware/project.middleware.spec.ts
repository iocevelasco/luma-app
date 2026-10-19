import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre en unit lo que el E2E no puede: la rama de "no tiene acceso" no se
 * ejercita con dos cuentas reales invitadas entre sí, así que el aislamiento
 * (404, nunca 403) se prueba acá mockeando los modelos.
 *
 * Qué puede cada rol es otra cosa y vive en `@luma/shared/permissions`, con su
 * propio test. Acá se prueba el cableado: que el rol se resuelva bien y que
 * `requireCapability` lo consulte.
 */
vi.mock('../../models/Project.js', () => ({
  Project: { findById: vi.fn() },
}));
vi.mock('../../models/ProjectMembership.js', () => ({
  ProjectMembership: { findOne: vi.fn() },
}));
vi.mock('../../services/subscription.service.js', () => ({ stateFor: vi.fn() }));

const { Project } = await import('../../models/Project.js');
const { ProjectMembership } = await import('../../models/ProjectMembership.js');
const { stateFor } = await import('../../services/subscription.service.js');

function subscription(canWrite: boolean) {
  return { status: canWrite ? 'activa' : 'vencida', canWrite, accessUntil: null, trialDaysLeft: null };
}
const { requireProjectAccess, requireCapability } = await import(
  '../../middleware/project.middleware.js'
);

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(userId = 'user-1'): Request {
  return { params: { projectId: 'p1' }, user: { sub: userId } } as unknown as Request;
}

/** `ProjectMembership.findOne(...).select(...)` devuelve esto. */
function membership(role: string | null) {
  return { select: vi.fn().mockResolvedValue(role ? { role } : null) };
}

const PROJECT = {
  _id: 'p1',
  createdBy: 'owner-1',
  organization: 'org-1',
  providersVisibleToClient: false,
};

describe('requireProjectAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProjectMembership.findOne).mockReturnValue(membership(null) as never);
    vi.mocked(stateFor).mockResolvedValue(subscription(true) as never);
  });

  it('404 si la obra no existe', async () => {
    vi.mocked(Project.findById).mockResolvedValue(null);
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('404, no 403, si no tiene ningún rol en la obra', async () => {
    vi.mocked(Project.findById).mockResolvedValue(PROJECT as never);
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(mockReq(), res, next);

    // Un 403 confirmaría que la obra existe, que es justo lo que el NFR de
    // aislamiento entre clientes distintos pide evitar.
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('quien creó la obra es gerente, sin consultar membresías', async () => {
    vi.mocked(Project.findById).mockResolvedValue(PROJECT as never);
    const req = mockReq('owner-1');
    const next = vi.fn();

    await requireProjectAccess(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.projectRole).toBe('gerente');
    expect(req.can?.('project.invite')).toBe(true);
    expect(ProjectMembership.findOne).not.toHaveBeenCalled();
  });

  it('el rol sale de la membresía cuando no creó la obra', async () => {
    vi.mocked(Project.findById).mockResolvedValue(PROJECT as never);
    vi.mocked(ProjectMembership.findOne).mockReturnValue(membership('supervisor') as never);
    const req = mockReq();
    const next = vi.fn();

    await requireProjectAccess(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.projectRole).toBe('supervisor');
    expect(req.can?.('project.invite')).toBe(false);
  });

  it('ser miembro de la Empresa ya no abre la obra por sí solo', async () => {
    // El Asistente de Obra de la v1 entraba a todas las obras de su Empresa.
    // La migración le crea una membresía por obra; sin ella, no entra.
    vi.mocked(Project.findById).mockResolvedValue(PROJECT as never);
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(mockReq('org-mate'), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('un id con formato inválido es 404, no 500', async () => {
    const { default: mongoose } = await import('mongoose');
    vi.mocked(Project.findById).mockRejectedValue(
      new mongoose.Error.CastError('ObjectId', 'nope', '_id'),
    );
    const res = mockRes();
    const next = vi.fn();

    await requireProjectAccess(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('`can` aplica el flag de la obra, no sólo el rol', async () => {
    vi.mocked(Project.findById).mockResolvedValue(PROJECT as never);
    vi.mocked(ProjectMembership.findOne).mockReturnValue(membership('cliente') as never);
    const req = mockReq();

    await requireProjectAccess(req, mockRes(), vi.fn());

    expect(req.can?.('provider.read')).toBe(false);

    vi.mocked(Project.findById).mockResolvedValue({
      ...PROJECT,
      providersVisibleToClient: true,
    } as never);
    const visible = mockReq();
    await requireProjectAccess(visible, mockRes(), vi.fn());

    expect(visible.can?.('provider.read')).toBe(true);
  });
});

describe('requireCapability', () => {
  it('deja pasar si `can` dice que sí', () => {
    const req = { can: () => true } as unknown as Request;
    const next = vi.fn();

    requireCapability('activity.plan')(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('403 con la capacidad que faltó', () => {
    const req = { can: () => false } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();

    requireCapability('budget.read')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        code: 'FORBIDDEN_CAPABILITY',
        details: { capability: 'budget.read' },
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('sin `can` en la request niega en vez de dejar pasar', () => {
    // Si alguien monta el gate sin `requireProjectAccess` antes, el error debe
    // ser un 403 y no un bypass silencioso.
    const res = mockRes();
    const next = vi.fn();

    requireCapability('budget.read')({} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('suscripción vencida: sólo lectura', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProjectMembership.findOne).mockReturnValue(membership(null) as never);
    vi.mocked(stateFor).mockResolvedValue(subscription(false) as never);
    vi.mocked(Project.findById).mockResolvedValue(PROJECT as never);
  });

  it('mira la suscripción de la Empresa dueña de la obra, no la de quien pregunta', async () => {
    await requireProjectAccess(mockReq('owner-1'), mockRes(), vi.fn());
    expect(stateFor).toHaveBeenCalledWith('org-1');
  });

  it('el gerente sigue entrando y viendo, pero `can` niega todo lo que escribe', async () => {
    const req = mockReq('owner-1');
    const next = vi.fn();

    await requireProjectAccess(req, mockRes(), next);

    expect(next).toHaveBeenCalled();
    expect(req.projectReadOnly).toBe(true);
    expect(req.can?.('activity.read')).toBe(true);
    expect(req.can?.('budget.read')).toBe(true);
    expect(req.can?.('activity.plan')).toBe(false);
    expect(req.can?.('advisor.use')).toBe(false);
  });

  it('un invitado tampoco escribe en la obra de un dueño vencido', async () => {
    vi.mocked(ProjectMembership.findOne).mockReturnValue(membership('supervisor') as never);
    const req = mockReq('supervisor-1');

    await requireProjectAccess(req, mockRes(), vi.fn());

    expect(req.can?.('activity.report')).toBe(false);
    expect(req.can?.('activity.read')).toBe(true);
  });

  it('requireCapability contesta 402 SUBSCRIPTION_REQUIRED, no 403, si el rol sí podía', async () => {
    const req = mockReq('owner-1');
    await requireProjectAccess(req, mockRes(), vi.fn());
    const res = mockRes();
    const next = vi.fn();

    requireCapability('activity.plan')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'SUBSCRIPTION_REQUIRED' }),
    );
  });

  it('si el rol no podía igual, sigue siendo 403: la suscripción no es la razón', async () => {
    vi.mocked(ProjectMembership.findOne).mockReturnValue(membership('cliente') as never);
    const req = mockReq('cliente-1');
    await requireProjectAccess(req, mockRes(), vi.fn());
    const res = mockRes();

    requireCapability('budget.read')(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
  });
});
