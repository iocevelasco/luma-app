import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre las reglas que no puede expresar Zod: el directorio de proveedores
 * es de la Empresa (`project.organization`), no de la obra, y asignar a una
 * actividad valida pertenencia cruzada (actividad↔proyecto, proveedor↔Empresa)
 * antes de tocar la tabla puente. Mismo patrón de mocks que
 * `material.controller.spec.ts`.
 */
vi.mock('../../models/Provider.js', () => ({
  Provider: { find: vi.fn(), create: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../../models/ActivityProvider.js', () => ({
  ActivityProvider: {
    find: vi.fn(),
    create: vi.fn(),
    exists: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
}));
vi.mock('../../models/Activity.js', () => ({
  Activity: { findOne: vi.fn() },
}));

const { Provider } = await import('../../models/Provider.js');
const { ActivityProvider } = await import('../../models/ActivityProvider.js');
const { Activity } = await import('../../models/Activity.js');
const {
  listProviders,
  createProvider,
  assignProvider,
  unassignProvider,
  listProviderActivities,
  assignActivityToProvider,
  unassignActivityFromProvider,
} = await import('../../controllers/provider.controller.js');

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function jsonData(res: Response): { success: boolean; error?: string; data?: unknown } {
  return (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
}

const baseProvider = {
  _id: 'provider-1',
  organization: 'org-1',
  name: 'Juan Electricista',
  specialty: 'electricidad',
  phone: '11-5555-5555',
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('listProviders — libreta de la Empresa MÁS los propios de esta obra', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pide los de la organization unidos a los de este proyecto, sólo activos', async () => {
    vi.mocked(Provider.find).mockReturnValue({ sort: vi.fn().mockResolvedValue([baseProvider]) } as never);
    const req = { project: { _id: 'project-1', organization: 'org-1' } } as unknown as Request;
    const res = mockRes();

    await listProviders(req, res);

    expect(Provider.find).toHaveBeenCalledWith({
      organization: 'org-1',
      $or: [{ scope: { $ne: 'project' } }, { project: 'project-1' }],
      active: true,
    });
    expect(jsonData(res)).toMatchObject({ success: true, data: { providers: [{ id: 'provider-1' }] } });
  });
});

describe('createProvider — organization viene del proyecto, nunca del body', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea el proveedor con la organization del proyecto autenticado', async () => {
    vi.mocked(Provider.create).mockResolvedValue(baseProvider as never);
    const req = {
      project: { organization: 'org-1' },
      body: { name: 'Juan Electricista', specialty: 'electricidad', phone: '11-5555-5555' },
    } as unknown as Request;
    const res = mockRes();

    await createProvider(req, res);

    expect(Provider.create).toHaveBeenCalledWith(
      expect.objectContaining({ organization: 'org-1' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('400 si falta el teléfono', async () => {
    const req = {
      project: { organization: 'org-1' },
      body: { name: 'Juan Electricista', specialty: 'electricidad', phone: '' },
    } as unknown as Request;
    const res = mockRes();

    await createProvider(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Provider.create).not.toHaveBeenCalled();
  });

  it('el de la libreta no queda atado a ninguna obra', async () => {
    vi.mocked(Provider.create).mockResolvedValue(baseProvider as never);
    const req = {
      project: { _id: 'project-1', organization: 'org-1' },
      body: { name: 'Juan', specialty: 'electricidad', phone: '11-1', scope: 'organization' },
    } as unknown as Request;
    const res = mockRes();

    await createProvider(req, res);

    expect(Provider.create).toHaveBeenCalledWith(expect.objectContaining({ project: null }));
  });

  it('el que trae el cliente queda atado a ESTA obra', async () => {
    vi.mocked(Provider.create).mockResolvedValue(baseProvider as never);
    const req = {
      project: { _id: 'project-1', organization: 'org-1' },
      body: { name: 'Vidriero del cliente', specialty: 'cristaleria', phone: '11-2', scope: 'project' },
    } as unknown as Request;
    const res = mockRes();

    await createProvider(req, res);

    expect(Provider.create).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'project', project: 'project-1' }),
    );
  });
});

describe('assignProvider — pertenencia cruzada antes de crear el vínculo', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockReq(overrides: Record<string, unknown> = {}): Request {
    return {
      project: { _id: 'project-1', organization: 'org-1' },
      params: { activityId: 'activity-1' },
      body: { providerId: 'provider-1' },
      ...overrides,
    } as unknown as Request;
  }

  it('404 si la actividad no pertenece a esa obra', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue(null);
    const res = mockRes();

    await assignProvider(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(ActivityProvider.create).not.toHaveBeenCalled();
  });

  it('404 si el proveedor no pertenece a la Empresa de la obra', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue({ _id: 'activity-1' } as never);
    vi.mocked(Provider.findOne).mockResolvedValue(null);
    const res = mockRes();

    await assignProvider(mockReq(), res);

    // El filtro incluye el alcance: un proveedor privado de otra obra tampoco
    // se puede asignar acá aunque sea de la misma Empresa.
    expect(Provider.findOne).toHaveBeenCalledWith({
      _id: 'provider-1',
      organization: 'org-1',
      $or: [{ scope: { $ne: 'project' } }, { project: 'project-1' }],
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(ActivityProvider.create).not.toHaveBeenCalled();
  });

  it('409 si ya está asignado', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue({ _id: 'activity-1' } as never);
    vi.mocked(Provider.findOne).mockResolvedValue(baseProvider as never);
    vi.mocked(ActivityProvider.exists).mockResolvedValue({ _id: 'link-1' } as never);
    const res = mockRes();

    await assignProvider(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(ActivityProvider.create).not.toHaveBeenCalled();
  });

  it('crea el vínculo cuando todo pertenece a la misma obra/Empresa', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue({ _id: 'activity-1' } as never);
    vi.mocked(Provider.findOne).mockResolvedValue(baseProvider as never);
    vi.mocked(ActivityProvider.exists).mockResolvedValue(null);
    const res = mockRes();

    await assignProvider(mockReq(), res);

    expect(ActivityProvider.create).toHaveBeenCalledWith({
      activity: 'activity-1',
      provider: 'provider-1',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('unassignProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404 si el vínculo no existe', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue({ _id: 'activity-1' } as never);
    vi.mocked(ActivityProvider.findOneAndDelete).mockResolvedValue(null);
    const req = {
      project: { _id: 'project-1' },
      params: { activityId: 'activity-1', providerId: 'provider-1' },
    } as unknown as Request;
    const res = mockRes();

    await unassignProvider(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('borra el vínculo cuando existe', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue({ _id: 'activity-1' } as never);
    vi.mocked(ActivityProvider.findOneAndDelete).mockResolvedValue({ _id: 'link-1' } as never);
    const req = {
      project: { _id: 'project-1' },
      params: { activityId: 'activity-1', providerId: 'provider-1' },
    } as unknown as Request;
    const res = mockRes();

    await unassignProvider(req, res);

    expect(ActivityProvider.findOneAndDelete).toHaveBeenCalledWith({
      activity: 'activity-1',
      provider: 'provider-1',
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { providerId: 'provider-1' } });
  });
});

const baseActivity = {
  _id: 'activity-1',
  project: 'project-1',
  name: 'Colocación de aberturas',
  area: 'Fachada',
  startDate: '2026-09-01',
  endDate: '2026-09-05',
  status: 'pendiente',
};

describe('listProviderActivities — mismo vínculo N:N visto desde el proveedor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404 si el proveedor no pertenece a la Empresa de la obra', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(null);
    const req = {
      project: { _id: 'project-1', organization: 'org-1' },
      params: { providerId: 'provider-1' },
    } as unknown as Request;
    const res = mockRes();

    await listProviderActivities(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('filtra las actividades a las de este proyecto, aunque el vínculo apunte a otro', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(baseProvider as never);
    vi.mocked(ActivityProvider.find).mockReturnValue({
      populate: vi.fn().mockResolvedValue([
        { activity: baseActivity },
        { activity: { ...baseActivity, _id: 'activity-2', project: 'otro-project' } },
      ]),
    } as never);
    const req = {
      project: { _id: 'project-1', organization: 'org-1' },
      params: { providerId: 'provider-1' },
    } as unknown as Request;
    const res = mockRes();

    await listProviderActivities(req, res);

    expect(jsonData(res)).toMatchObject({
      success: true,
      data: { activities: [{ id: 'activity-1' }] },
    });
  });
});

describe('assignActivityToProvider — pertenencia cruzada antes de crear el vínculo', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockReq(overrides: Record<string, unknown> = {}): Request {
    return {
      project: { _id: 'project-1', organization: 'org-1' },
      params: { providerId: 'provider-1' },
      body: { activityId: 'activity-1' },
      ...overrides,
    } as unknown as Request;
  }

  it('404 si el proveedor no pertenece a la Empresa de la obra', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(null);
    const res = mockRes();

    await assignActivityToProvider(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(ActivityProvider.create).not.toHaveBeenCalled();
  });

  it('404 si la actividad no pertenece a esa obra', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(baseProvider as never);
    vi.mocked(Activity.findOne).mockResolvedValue(null);
    const res = mockRes();

    await assignActivityToProvider(mockReq(), res);

    expect(Activity.findOne).toHaveBeenCalledWith({ _id: 'activity-1', project: 'project-1' });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(ActivityProvider.create).not.toHaveBeenCalled();
  });

  it('409 si ya está asignado', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(baseProvider as never);
    vi.mocked(Activity.findOne).mockResolvedValue(baseActivity as never);
    vi.mocked(ActivityProvider.exists).mockResolvedValue({ _id: 'link-1' } as never);
    const res = mockRes();

    await assignActivityToProvider(mockReq(), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(ActivityProvider.create).not.toHaveBeenCalled();
  });

  it('crea el vínculo cuando todo pertenece a la misma obra/Empresa', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(baseProvider as never);
    vi.mocked(Activity.findOne).mockResolvedValue(baseActivity as never);
    vi.mocked(ActivityProvider.exists).mockResolvedValue(null);
    const res = mockRes();

    await assignActivityToProvider(mockReq(), res);

    expect(ActivityProvider.create).toHaveBeenCalledWith({
      activity: 'activity-1',
      provider: 'provider-1',
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('unassignActivityFromProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404 si el proveedor no pertenece a la Empresa de la obra', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(null);
    const req = {
      project: { _id: 'project-1', organization: 'org-1' },
      params: { providerId: 'provider-1', activityId: 'activity-1' },
    } as unknown as Request;
    const res = mockRes();

    await unassignActivityFromProvider(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('borra el vínculo cuando existe', async () => {
    vi.mocked(Provider.findOne).mockResolvedValue(baseProvider as never);
    vi.mocked(ActivityProvider.findOneAndDelete).mockResolvedValue({ _id: 'link-1' } as never);
    const req = {
      project: { _id: 'project-1', organization: 'org-1' },
      params: { providerId: 'provider-1', activityId: 'activity-1' },
    } as unknown as Request;
    const res = mockRes();

    await unassignActivityFromProvider(req, res);

    expect(ActivityProvider.findOneAndDelete).toHaveBeenCalledWith({
      activity: 'activity-1',
      provider: 'provider-1',
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { activityId: 'activity-1' } });
  });
});
