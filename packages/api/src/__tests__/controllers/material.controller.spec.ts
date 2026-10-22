import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canInProject, type Capability, type ProjectRole } from '@luma/shared';
import type { NextFunction, Request, Response } from 'express';

/**
 * Cubre la regla de negocio que no puede vivir en Zod: `activityId` (si
 * viene) tiene que pertenecer al mismo `project` que el material. Necesita ir
 * a la base, así que se prueba acá con los modelos mockeados, mismo patrón
 * que `project.middleware.spec.ts`.
 */
vi.mock('../../models/Activity.js', () => ({
  Activity: { findOne: vi.fn() },
}));
vi.mock('../../models/MaterialItem.js', () => ({
  MaterialItem: {
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
    exists: vi.fn(),
    find: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

const { Activity } = await import('../../models/Activity.js');
const { MaterialItem } = await import('../../models/MaterialItem.js');
const {
  bulkDeleteMaterials,
  bulkUpdateMaterials,
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
} = await import(
  '../../controllers/material.controller.js'
);
const { isAppError } = await import('../../utils/errors.js');

/** El `next` al que `wrap` le manda los errores lanzados. */
function mockNext() {
  return vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
}

function thrownBy(next: ReturnType<typeof mockNext>) {
  const error = next.mock.calls[0]?.[0];
  expect(isAppError(error)).toBe(true);
  return error as { code: string; status: number };
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    user: { sub: 'user-1' },
    project: { _id: 'project-1' },
    body: {
      name: 'Cemento',
      quantity: 10,
      unit: 'bolsa',
      ...overrides,
    },
  } as unknown as Request;
}

describe('createMaterial — pertenencia de activity al project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400 si la actividad no pertenece a esa obra', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue(null);
    const req = mockReq({ activityId: 'activity-de-otra-obra' });
    const res = mockRes();
    const next = mockNext();

    await createMaterial(req, res, next);

    expect(Activity.findOne).toHaveBeenCalledWith({
      _id: 'activity-de-otra-obra',
      project: 'project-1',
    });
    expect(thrownBy(next)).toMatchObject({ code: 'VALIDATION', status: 400 });
    expect(MaterialItem.create).not.toHaveBeenCalled();
  });

  it('crea el material si la actividad sí pertenece a la obra', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue({ _id: 'activity-1' } as never);
    vi.mocked(MaterialItem.create).mockResolvedValue({
      _id: 'm1',
      project: 'project-1',
      activity: 'activity-1',
      name: 'Cemento',
      quantity: 10,
      unit: 'bolsa',
      status: 'pendiente',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const req = mockReq({ activityId: 'activity-1' });
    const res = mockRes();

    await createMaterial(req, res, mockNext());

    expect(MaterialItem.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('no valida nada contra Activity si no viene activityId', async () => {
    vi.mocked(MaterialItem.create).mockResolvedValue({
      _id: 'm1',
      project: 'project-1',
      name: 'Cemento',
      quantity: 10,
      unit: 'bolsa',
      status: 'pendiente',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const req = mockReq();
    const res = mockRes();

    await createMaterial(req, res, mockNext());

    expect(Activity.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});


/**
 * `can` armado contra la grilla real de `@luma/shared`, no un booleano a mano:
 * si un permiso cambia en la grilla, este test lo nota.
 */
function canFor(role: ProjectRole, project: { providersVisibleToClient?: boolean } = {}) {
  return (capability: Capability) =>
    canInProject(role, capability, { providersVisibleToClient: false, ...project });
}

describe('listMaterials — estimatedCost sólo para quien puede editar', () => {
  const material = {
    _id: 'm1',
    project: 'project-1',
    name: 'Cemento',
    quantity: 10,
    unit: 'bolsa',
    status: 'pendiente',
    estimatedCost: 5000,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(MaterialItem.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([material]),
    } as never);
  });

  it('el dueño ve estimatedCost', async () => {
    const req = { project: { _id: 'project-1' }, can: canFor('gerente') } as unknown as Request;
    const res = mockRes();

    await listMaterials(req, res, mockNext());

    const [{ materials }] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0].map(
      (arg: { data: { materials: unknown[] } }) => arg.data,
    );
    expect(materials[0]).toMatchObject({ estimatedCost: 5000 });
  });

  it('el supervisor también ve estimatedCost', async () => {
    const req = { project: { _id: 'project-1' }, can: canFor('supervisor') } as unknown as Request;
    const res = mockRes();

    await listMaterials(req, res, mockNext());

    const [{ materials }] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0].map(
      (arg: { data: { materials: unknown[] } }) => arg.data,
    );
    expect(materials[0]).toMatchObject({ estimatedCost: 5000 });
  });

  it('el cliente invitado no recibe estimatedCost', async () => {
    const req = { project: { _id: 'project-1' }, can: canFor('cliente') } as unknown as Request;
    const res = mockRes();

    await listMaterials(req, res, mockNext());

    const [{ materials }] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0].map(
      (arg: { data: { materials: unknown[] } }) => arg.data,
    );
    expect((materials[0] as { estimatedCost?: number }).estimatedCost).toBeUndefined();
  });
});


const projectReq = (overrides: Record<string, unknown> = {}) =>
  ({
    user: { sub: 'user-1' },
    project: { _id: 'project-1' },
    params: { materialId: 'm1' },
    body: {},
    ...overrides,
  }) as unknown as Request;

function stored(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'm1',
    project: 'project-1',
    name: 'Cemento',
    quantity: 10,
    unit: 'bolsa',
    status: 'pendiente',
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('toMaterialDTO — editable', () => {
  it('un pendiente sin mover viene editable; uno que ya se movió, no', async () => {
    vi.mocked(MaterialItem.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        stored(),
        stored({ _id: 'm2', status: 'solicitado', statusChangedAt: new Date() }),
        // Pendiente que volvió: se movió alguna vez, sigue bloqueado.
        stored({ _id: 'm3', statusChangedAt: new Date() }),
      ]),
    } as never);
    const res = mockRes();

    await listMaterials(
      { project: { _id: 'project-1' }, can: canFor('gerente') } as unknown as Request,
      res,
      mockNext(),
    );

    const { materials } = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0].data;
    expect(materials.map((m: { editable: boolean }) => m.editable)).toEqual([true, false, false]);
  });
});

describe('updateMaterial — bloqueo por estado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('edita el contenido de un pendiente con un filtro atómico', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockResolvedValue(stored({ quantity: 12 }) as never);
    const res = mockRes();
    const next = mockNext();

    await updateMaterial(projectReq({ body: { quantity: 12 } }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(MaterialItem.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'm1', project: 'project-1', status: 'pendiente', statusChangedAt: null },
      { $set: { quantity: 12 } },
      { new: true },
    );
  });

  it('409 MATERIAL_LOCKED si ya salió de Pendiente, y no escribe', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(
      stored({ status: 'solicitado', statusChangedAt: new Date() }) as never,
    );
    const next = mockNext();

    await updateMaterial(projectReq({ body: { quantity: 12 } }), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'MATERIAL_LOCKED', status: 409 });
    expect(MaterialItem.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('un pendiente que volvió de Solicitado sigue bloqueado', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(
      stored({ statusChangedAt: new Date() }) as never,
    );
    const next = mockNext();

    await updateMaterial(projectReq({ body: { name: 'Otro' } }), mockRes(), next);

    expect(thrownBy(next).code).toBe('MATERIAL_LOCKED');
  });

  it('cambiar sólo el estado se permite aunque esté bloqueado', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(
      stored({ status: 'solicitado', statusChangedAt: new Date() }) as never,
    );
    vi.mocked(MaterialItem.findOneAndUpdate).mockResolvedValue(
      stored({ status: 'comprado', statusChangedAt: new Date() }) as never,
    );
    const next = mockNext();

    await updateMaterial(projectReq({ body: { status: 'comprado' } }), mockRes(), next);

    expect(next).not.toHaveBeenCalled();
    const [filter, update] = vi.mocked(MaterialItem.findOneAndUpdate).mock.calls[0] as never[];
    // Sin el filtro de editable: el camino de la compra no se frena.
    expect(filter).toEqual({ _id: 'm1', project: 'project-1' });
    expect((update as { $set: Record<string, unknown> }).$set).toMatchObject({
      status: 'comprado',
      statusChangedBy: 'user-1',
    });
  });

  it('carrera: lo movieron entre la lectura y la escritura → 409, no pisa', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockResolvedValue(null as never);
    vi.mocked(MaterialItem.exists).mockResolvedValue({ _id: 'm1' } as never);
    const next = mockNext();

    await updateMaterial(projectReq({ body: { quantity: 12 } }), mockRes(), next);

    expect(thrownBy(next).code).toBe('MATERIAL_LOCKED');
  });

  it('carrera: lo borraron entre la lectura y la escritura → 404', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockResolvedValue(null as never);
    vi.mocked(MaterialItem.exists).mockResolvedValue(null as never);
    const next = mockNext();

    await updateMaterial(projectReq({ body: { quantity: 12 } }), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('404 si el material no es de esa obra', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(null as never);
    const next = mockNext();

    await updateMaterial(projectReq({ body: { quantity: 12 } }), mockRes(), next);

    expect(thrownBy(next).code).toBe('NOT_FOUND');
  });

  it('null o texto vacío sacan el costo y el proveedor con $unset', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockResolvedValue(stored() as never);

    await updateMaterial(
      projectReq({ body: { estimatedCost: null, supplier: '' } }),
      mockRes(),
      mockNext(),
    );

    const [, update] = vi.mocked(MaterialItem.findOneAndUpdate).mock.calls[0] as never[];
    expect(update).toEqual({ $unset: { estimatedCost: '', supplier: '' } });
  });

  it('400 si el body no valida', async () => {
    const next = mockNext();

    await updateMaterial(projectReq({ body: { quantity: -1 } }), mockRes(), next);

    expect(thrownBy(next).code).toBe('VALIDATION');
  });
});

describe('deleteMaterial — bloqueo por estado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('elimina un pendiente sin mover con el filtro atómico', async () => {
    vi.mocked(MaterialItem.findOneAndDelete).mockResolvedValue(stored() as never);
    const res = mockRes();
    const next = mockNext();

    await deleteMaterial(projectReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(MaterialItem.findOneAndDelete).toHaveBeenCalledWith({
      _id: 'm1',
      project: 'project-1',
      status: 'pendiente',
      statusChangedAt: null,
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { materialId: 'm1' } });
  });

  it('409 MATERIAL_LOCKED si el material existe pero ya se movió', async () => {
    vi.mocked(MaterialItem.findOneAndDelete).mockResolvedValue(null as never);
    vi.mocked(MaterialItem.exists).mockResolvedValue({ _id: 'm1' } as never);
    const next = mockNext();

    await deleteMaterial(projectReq(), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'MATERIAL_LOCKED', status: 409 });
  });

  it('404 si no existe', async () => {
    vi.mocked(MaterialItem.findOneAndDelete).mockResolvedValue(null as never);
    vi.mocked(MaterialItem.exists).mockResolvedValue(null as never);
    const next = mockNext();

    await deleteMaterial(projectReq(), mockRes(), next);

    expect(thrownBy(next).code).toBe('NOT_FOUND');
  });
});

describe('acciones en lote', () => {
  const A = 'a'.repeat(24);
  const B = 'b'.repeat(24);

  function bulkReq(body: Record<string, unknown>): Request {
    return { user: { sub: 'user-1' }, project: { _id: 'project-1' }, body } as unknown as Request;
  }

  function material(id: string, status: string, statusChangedAt?: Date) {
    return { _id: id, status, statusChangedAt };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cambia el estado de todos y no reescribe a los que ya estaban ahí', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([
      material(A, 'pendiente'),
      material(B, 'solicitado', new Date()),
    ] as never);
    const res = mockRes();
    const next = mockNext();

    await bulkUpdateMaterials(bulkReq({ ids: [A, B, A], status: 'solicitado' }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(MaterialItem.updateMany).toHaveBeenCalledWith(
      { _id: { $in: [A, B] }, project: 'project-1', status: { $ne: 'solicitado' } },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'solicitado' }) }),
    );
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { materialIds: [A, B] } });
  });

  it('404 y no toca nada si alguno no es de esta obra', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([material(A, 'pendiente')] as never);
    const next = mockNext();

    await bulkUpdateMaterials(bulkReq({ ids: [A, B], status: 'comprado' }), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(MaterialItem.updateMany).not.toHaveBeenCalled();
  });

  it('400 con una lista vacía o un id mal formado', async () => {
    for (const ids of [[], ['no-es-un-id']]) {
      const next = mockNext();
      await bulkUpdateMaterials(bulkReq({ ids, status: 'comprado' }), mockRes(), next);
      expect(thrownBy(next)).toMatchObject({ code: 'VALIDATION', status: 400 });
    }
    expect(MaterialItem.find).not.toHaveBeenCalled();
  });

  it('borra todos si todos siguen en Pendiente', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([
      material(A, 'pendiente'),
      material(B, 'pendiente'),
    ] as never);
    const res = mockRes();
    const next = mockNext();

    await bulkDeleteMaterials(bulkReq({ ids: [A, B] }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(MaterialItem.deleteMany).toHaveBeenCalledWith({
      _id: { $in: [A, B] },
      project: 'project-1',
      status: 'pendiente',
      statusChangedAt: null,
    });
  });

  it('409 con los bloqueados y no borra ninguno si uno salió de Pendiente', async () => {
    vi.mocked(MaterialItem.find).mockResolvedValue([
      material(A, 'pendiente'),
      material(B, 'solicitado', new Date()),
    ] as never);
    const next = mockNext();

    await bulkDeleteMaterials(bulkReq({ ids: [A, B] }), mockRes(), next);

    expect(thrownBy(next)).toMatchObject({ code: 'MATERIAL_LOCKED', status: 409 });
    expect((next.mock.calls[0]?.[0] as { details: unknown }).details).toEqual({ ids: [B] });
    expect(MaterialItem.deleteMany).not.toHaveBeenCalled();
  });
});
