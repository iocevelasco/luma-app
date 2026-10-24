import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canInProject } from '@luma/shared';
import type { NextFunction, Request, Response } from 'express';

/**
 * La foto de referencia de un material: se agrega, se cambia y se saca en
 * cualquier estado, y nunca deja un archivo huérfano. Modelos y storage
 * mockeados, mismo patrón que `material.controller.spec.ts`.
 */
vi.mock('../../models/Activity.js', () => ({ Activity: { findOne: vi.fn() } }));
vi.mock('../../models/MaterialItem.js', () => ({
  MaterialItem: {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
    find: vi.fn(),
    deleteMany: vi.fn(),
    exists: vi.fn(),
  },
}));
vi.mock('../../models/Expense.js', () => ({
  Expense: { find: vi.fn(() => ({ sort: vi.fn().mockResolvedValue([]) })) },
}));
vi.mock('../../models/Provider.js', () => ({ Provider: { findOne: vi.fn() } }));
vi.mock('../../services/directory.service.js', () => ({
  visibleProviderFilter: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../services/storage.service.js', () => ({
  signObjectUrl: vi.fn(),
  deleteObject: vi.fn(),
  uploadMaterialPhoto: vi.fn(),
  readObject: vi.fn(),
  uploadProjectDocument: vi.fn(),
  StorageNotConfiguredError: class StorageNotConfiguredError extends Error {},
}));

const { MaterialItem } = await import('../../models/MaterialItem.js');
const storage = await import('../../services/storage.service.js');
const {
  bulkDeleteMaterials,
  deleteMaterial,
  deleteMaterialPhoto,
  getMaterialPhoto,
  listMaterials,
  uploadMaterialPhoto,
} = await import('../../controllers/material.controller.js');
const { isAppError } = await import('../../utils/errors.js');

const populated = <T>(value: T) => ({ populate: vi.fn().mockResolvedValue(value) });
const listQuery = <T>(items: T) => ({
  populate: vi.fn().mockReturnValue({ sort: vi.fn().mockResolvedValue(items) }),
});

const mockNext = () => vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
function thrownBy(next: ReturnType<typeof mockNext>) {
  const error = next.mock.calls[0]?.[0];
  expect(isAppError(error)).toBe(true);
  return error as { code: string; status: number };
}
function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}
const body = (res: Response) =>
  (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0].data as {
    materials?: Array<{ photoUrl: string | null }>;
    material?: { photoUrl: string | null };
  };

const PHOTO = {
  key: 'old-key',
  contentType: 'image/jpeg',
  uploadedBy: 'user-1',
  uploadedAt: new Date(),
};

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

function req(overrides: Record<string, unknown> = {}) {
  return {
    user: { sub: 'user-1' },
    project: { _id: 'project-1' },
    params: { materialId: 'm1' },
    body: {},
    file: { buffer: Buffer.from('x'), mimetype: 'image/jpeg', size: 1 },
    can: (capability: never) => canInProject('gerente', capability),
    ...overrides,
  } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(storage.signObjectUrl).mockResolvedValue('https://files.test/signed');
  vi.mocked(storage.deleteObject).mockResolvedValue(undefined);
  vi.mocked(storage.uploadMaterialPhoto).mockResolvedValue({ key: 'new-key' });
});

describe('listMaterials — photoUrl', () => {
  it('firma la foto de los que la tienen y deja null a los que no', async () => {
    vi.mocked(MaterialItem.find).mockReturnValue(
      listQuery([stored({ photo: PHOTO }), stored({ _id: 'm2' })]) as never,
    );
    const res = mockRes();

    await listMaterials(req(), res, mockNext());

    expect(body(res).materials?.map((m) => m.photoUrl)).toEqual(['https://files.test/signed', null]);
    expect(storage.signObjectUrl).toHaveBeenCalledTimes(1);
    expect(storage.signObjectUrl).toHaveBeenCalledWith('old-key');
  });

  it('si no puede firmar una foto, la lista sale igual (esa fila sin foto)', async () => {
    vi.mocked(MaterialItem.find).mockReturnValue(listQuery([stored({ photo: PHOTO })]) as never);
    vi.mocked(storage.signObjectUrl).mockRejectedValue(new Error('media-service caído'));
    const next = mockNext();
    const res = mockRes();

    await listMaterials(req(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(body(res).materials?.[0].photoUrl).toBeNull();
  });
});

describe('uploadMaterialPhoto', () => {
  it('sin archivo es un pedido inválido y no toca el storage', async () => {
    const next = mockNext();

    await uploadMaterialPhoto(req({ file: undefined }), mockRes(), next);

    expect(thrownBy(next).status).toBe(400);
    expect(storage.uploadMaterialPhoto).not.toHaveBeenCalled();
  });

  it('rechaza lo que no es una foto soportada', async () => {
    const next = mockNext();

    await uploadMaterialPhoto(
      req({ file: { buffer: Buffer.from('x'), mimetype: 'application/pdf', size: 1 } }),
      mockRes(),
      next,
    );

    expect(thrownBy(next).status).toBe(400);
    expect(storage.uploadMaterialPhoto).not.toHaveBeenCalled();
  });

  it('un material de otra obra es 404 y no sube nada', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(null as never);
    const next = mockNext();

    await uploadMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(404);
    expect(storage.uploadMaterialPhoto).not.toHaveBeenCalled();
  });

  it('guarda la foto, devuelve la URL y la pide con el id de la obra, no del body', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockReturnValue(
      populated(stored({ photo: { ...PHOTO, key: 'new-key' } })) as never,
    );
    const res = mockRes();

    await uploadMaterialPhoto(req(), res, mockNext());

    expect(MaterialItem.findOne).toHaveBeenCalledWith({ _id: 'm1', project: 'project-1' });
    expect(storage.uploadMaterialPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1', materialId: 'm1', extension: '.jpg' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(body(res).material?.photoUrl).toBe('https://files.test/signed');
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('funciona en un material que ya salió de Pendiente: documentar no es corregir', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(
      stored({ status: 'comprado', statusChangedAt: new Date() }) as never,
    );
    vi.mocked(MaterialItem.findOneAndUpdate).mockReturnValue(
      populated(stored({ status: 'comprado', photo: PHOTO })) as never,
    );
    const next = mockNext();

    await uploadMaterialPhoto(req(), mockRes(), next);

    expect(next).not.toHaveBeenCalled();
    const [filter] = vi.mocked(MaterialItem.findOneAndUpdate).mock.calls[0] as never[];
    expect(filter).not.toHaveProperty('status');
  });

  it('al reemplazar, borra el archivo anterior', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockReturnValue(
      populated(stored({ photo: { ...PHOTO, key: 'new-key' } })) as never,
    );

    await uploadMaterialPhoto(req(), mockRes(), mockNext());

    expect(storage.deleteObject).toHaveBeenCalledWith('old-key');
  });

  it('si borran el material a mitad de camino, no deja la foto nueva huérfana', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockReturnValue(populated(null) as never);
    const next = mockNext();

    await uploadMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(404);
    expect(storage.deleteObject).toHaveBeenCalledWith('new-key');
  });

  it('si el storage no está configurado, dice 503 y no guarda nada', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    vi.mocked(storage.uploadMaterialPhoto).mockRejectedValue(new storage.StorageNotConfiguredError());
    const next = mockNext();

    await uploadMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(503);
    expect(MaterialItem.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('si no puede borrar el archivo anterior, la foto nueva igual queda guardada', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockReturnValue(
      populated(stored({ photo: { ...PHOTO, key: 'new-key' } })) as never,
    );
    vi.mocked(storage.deleteObject).mockRejectedValue(new Error('storage caído'));
    const next = mockNext();
    const res = mockRes();

    await uploadMaterialPhoto(req(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('deleteMaterialPhoto', () => {
  it('saca la foto del material y borra el archivo', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockReturnValue(populated(stored()) as never);
    const res = mockRes();

    await deleteMaterialPhoto(req(), res, mockNext());

    const [, update] = vi.mocked(MaterialItem.findOneAndUpdate).mock.calls[0] as never[];
    expect(update).toEqual({ $unset: { photo: '' } });
    expect(storage.deleteObject).toHaveBeenCalledWith('old-key');
    expect(body(res).material?.photoUrl).toBeNull();
  });

  it('es idempotente: sin foto no hay archivo que borrar', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockReturnValue(populated(stored()) as never);
    const next = mockNext();

    await deleteMaterialPhoto(req(), mockRes(), next);

    expect(next).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('un material que no existe es 404', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(null as never);
    const next = mockNext();

    await deleteMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(404);
  });
});

describe('borrar un material borra su foto', () => {
  it('de a uno', async () => {
    vi.mocked(MaterialItem.findOneAndDelete).mockResolvedValue(stored({ photo: PHOTO }) as never);

    await deleteMaterial(req(), mockRes(), mockNext());

    expect(storage.deleteObject).toHaveBeenCalledWith('old-key');
  });

  it('en lote, sólo de los que de verdad se borraron', async () => {
    const A = 'a'.repeat(24);
    const B = 'b'.repeat(24);
    vi.mocked(MaterialItem.find)
      // 1) los materiales a borrar; 2) los que sobrevivieron a la ventana de carrera.
      .mockResolvedValueOnce([
        stored({ _id: A, photo: { ...PHOTO, key: 'k1' } }),
        stored({ _id: B, photo: { ...PHOTO, key: 'k2' } }),
      ] as never)
      .mockReturnValueOnce({ distinct: vi.fn().mockResolvedValue([B]) } as never);
    vi.mocked(MaterialItem.deleteMany).mockResolvedValue({ deletedCount: 1 } as never);

    await bulkDeleteMaterials(req({ body: { ids: [A, B] } }), mockRes(), mockNext());

    expect(storage.deleteObject).toHaveBeenCalledTimes(1);
    expect(storage.deleteObject).toHaveBeenCalledWith('k1');
  });
});

describe('getMaterialPhoto', () => {
  it('sirve los bytes con el tipo de la foto y sin compartirla entre usuarios', async () => {
    const bytes = Buffer.from('jpeg');
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);
    vi.mocked(storage.readObject).mockResolvedValue({ buffer: bytes, contentType: 'image/jpeg' });
    const res = mockRes();

    await getMaterialPhoto(req(), res, mockNext());

    expect(MaterialItem.findOne).toHaveBeenCalledWith({ _id: 'm1', project: 'project-1' });
    expect(storage.readObject).toHaveBeenCalledWith('old-key');
    expect(res.type).toHaveBeenCalledWith('image/jpeg');
    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300');
    expect(res.send).toHaveBeenCalledWith(bytes);
  });

  it('un material sin foto es 404 y no va al storage', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    const next = mockNext();

    await getMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(404);
    expect(storage.readObject).not.toHaveBeenCalled();
  });

  it('un material de otra obra es 404', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(null as never);
    const next = mockNext();

    await getMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(404);
  });

  it('si el archivo ya no está en el storage, es 404', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);
    vi.mocked(storage.readObject).mockResolvedValue(null);
    const next = mockNext();

    await getMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(404);
  });
});
