import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no puede expresar Zod: el adelanto se valida contra la
 * cotización YA GUARDADA (no sólo contra la del mismo request), los
 * requisitos no pueden apuntar a actividades de otra obra, y marcar un
 * requisito cumplido no toca montos ni estado.
 */
vi.mock('../../models/ProviderEngagement.js', () => ({
  ProviderEngagement: {
    find: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
}));
vi.mock('../../models/Provider.js', () => ({ Provider: { findOne: vi.fn() } }));
vi.mock('../../models/Activity.js', () => ({ Activity: { countDocuments: vi.fn() } }));

const { ProviderEngagement } = await import('../../models/ProviderEngagement.js');
const { Provider } = await import('../../models/Provider.js');
const { Activity } = await import('../../models/Activity.js');
const { createProviderEngagement, updateProviderEngagement, setRequirementMet } = await import(
  '../../controllers/provider-engagement.controller.js'
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

const project = { _id: 'project-1', organization: 'org-1' };
const provider = { _id: 'provider-1' };

/** Documento de contratación con `set`/`save` espiables y subdocs por id. */
function mockEngagement(overrides: Record<string, unknown> = {}) {
  const requirement = { _id: 'req-1', type: 'materiales_en_obra', met: false };
  return {
    _id: 'engagement-1',
    project: 'project-1',
    provider: 'provider-1',
    status: 'cotizada',
    quotedAmount: 100_000,
    advanceAmount: undefined,
    requirements: Object.assign([requirement], {
      id: (id: string) => (id === 'req-1' ? requirement : null),
      map: Array.prototype.map.bind([requirement]),
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
    set: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('createProviderEngagement', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockReq(body: Record<string, unknown>): Request {
    return {
      user: { sub: 'user-1' },
      project,
      params: { providerId: 'provider-1' },
      body,
    } as unknown as Request;
  }

  it('404 si el proveedor no es visible desde esta obra', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(null);
    const res = mockRes();

    await createProviderEngagement(mockReq({}), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(ProviderEngagement.create).not.toHaveBeenCalled();
  });

  it('nace como "solicitada" cuando no se aclara el estado', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(provider as never);
    vi.mocked(ProviderEngagement.create).mockResolvedValue(mockEngagement() as never);
    const res = mockRes();

    await createProviderEngagement(mockReq({}), res);

    expect(ProviderEngagement.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'solicitada', project: 'project-1', provider: 'provider-1' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('400 si un requisito apunta a una actividad de otra obra', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(provider as never);
    vi.mocked(Activity.countDocuments).mockResolvedValue(0 as never);
    const res = mockRes();

    await createProviderEngagement(
      mockReq({ requirements: [{ type: 'actividad_previa', activityId: 'de-otra-obra' }] }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProviderEngagement.create).not.toHaveBeenCalled();
  });

  it('acepta el requisito cuando la actividad sí es de esta obra', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(provider as never);
    vi.mocked(Activity.countDocuments).mockResolvedValue(1 as never);
    vi.mocked(ProviderEngagement.create).mockResolvedValue(mockEngagement() as never);
    const res = mockRes();

    await createProviderEngagement(
      mockReq({ requirements: [{ type: 'actividad_previa', activityId: 'activity-1' }] }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('400 si "otro" viene sin descripción', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(provider as never);
    const res = mockRes();

    await createProviderEngagement(mockReq({ requirements: [{ type: 'otro' }] }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('updateProviderEngagement — el adelanto se valida contra lo ya guardado', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockReq(body: Record<string, unknown>): Request {
    return {
      project,
      params: { providerId: 'provider-1', engagementId: 'engagement-1' },
      body,
    } as unknown as Request;
  }

  it('400 si el adelanto supera la cotización que ya estaba guardada', async () => {
    vi.mocked(ProviderEngagement.findOne).mockResolvedValue(mockEngagement() as never);
    const res = mockRes();

    // El body trae sólo el adelanto: el tope es el `quotedAmount` del documento.
    await updateProviderEngagement(mockReq({ advanceAmount: 500_000 }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonBody(res).error).toMatch(/adelanto/i);
  });

  it('acepta un adelanto dentro de lo cotizado', async () => {
    const engagement = mockEngagement();
    vi.mocked(ProviderEngagement.findOne).mockResolvedValue(engagement as never);
    const res = mockRes();

    await updateProviderEngagement(mockReq({ advanceAmount: 30_000, status: 'aprobada' }), res);

    expect(engagement.set).toHaveBeenCalledWith(
      expect.objectContaining({ advanceAmount: 30_000, status: 'aprobada' }),
    );
    expect(engagement.save).toHaveBeenCalled();
  });

  it('404 si la contratación no es de esta obra', async () => {
    vi.mocked(ProviderEngagement.findOne).mockResolvedValue(null);
    const res = mockRes();

    await updateProviderEngagement(mockReq({ status: 'aprobada' }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('setRequirementMet — el Asistente marca requisitos, no toca plata', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockReq(body: unknown): Request {
    return {
      project,
      params: {
        providerId: 'provider-1',
        engagementId: 'engagement-1',
        requirementId: 'req-1',
      },
      body,
    } as unknown as Request;
  }

  it('400 si `met` no es booleano', async () => {
    const res = mockRes();

    await setRequirementMet(mockReq({ met: 'sí' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('marca el requisito y guarda, sin tocar montos ni estado', async () => {
    const engagement = mockEngagement();
    vi.mocked(ProviderEngagement.findOne).mockResolvedValue(engagement as never);
    const res = mockRes();

    await setRequirementMet(mockReq({ met: true }), res);

    expect(engagement.requirements.id('req-1')?.met).toBe(true);
    expect(engagement.set).not.toHaveBeenCalled();
    expect(engagement.save).toHaveBeenCalled();
  });

  it('404 si el requisito no existe en esa contratación', async () => {
    const engagement = mockEngagement({
      requirements: Object.assign([], { id: () => null, map: () => [] }),
    });
    vi.mocked(ProviderEngagement.findOne).mockResolvedValue(engagement as never);
    const res = mockRes();

    await setRequirementMet(mockReq({ met: true }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
