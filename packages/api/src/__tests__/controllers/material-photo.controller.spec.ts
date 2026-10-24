import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canInProject } from '@luma/shared';
import { Readable, Writable } from 'node:stream';
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
  openObject: vi.fn(),
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
    materials?: Array<{ photoUrl: string | null; photoUploadedAt: string | null }>;
    material?: { photoUrl: string | null; photoUploadedAt: string | null };
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
    expect(body(res).materials?.map((m) => m.photoUploadedAt)).toEqual([PHOTO.uploadedAt.toISOString(), null]);
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
  /** El material existe y, al reemplazarle la foto, el update devuelve cómo estaba (`previous`). */
  function whenUploading({ previous = stored(), after = stored({ photo: { ...PHOTO, key: 'new-key' } }) } = {}) {
    vi.mocked(MaterialItem.exists).mockResolvedValue({ _id: 'm1' } as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockResolvedValue(previous as never);
    vi.mocked(MaterialItem.findOne).mockReturnValue(populated(after) as never);
  }

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
    vi.mocked(MaterialItem.exists).mockResolvedValue(null as never);
    const next = mockNext();

    await uploadMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(404);
    expect(storage.uploadMaterialPhoto).not.toHaveBeenCalled();
  });

  it('guarda la foto, devuelve la URL y su versión, y busca el material por la obra del request', async () => {
    whenUploading({ after: stored({ photo: { ...PHOTO, key: 'new-key', uploadedAt: new Date('2026-10-24T10:00:00Z') } }) });
    const res = mockRes();

    await uploadMaterialPhoto(req(), res, mockNext());

    expect(MaterialItem.exists).toHaveBeenCalledWith({ _id: 'm1', project: 'project-1' });
    expect(storage.uploadMaterialPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1', materialId: 'm1', extension: '.jpg' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(body(res).material).toMatchObject({
      photoUrl: 'https://files.test/signed',
      photoUploadedAt: '2026-10-24T10:00:00.000Z',
    });
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('funciona en un material que ya salió de Pendiente: documentar no es corregir', async () => {
    whenUploading({ previous: stored({ status: 'comprado', statusChangedAt: new Date() }) });
    const next = mockNext();

    await uploadMaterialPhoto(req(), mockRes(), next);

    expect(next).not.toHaveBeenCalled();
    const [filter] = vi.mocked(MaterialItem.findOneAndUpdate).mock.calls[0] as never[];
    expect(filter).not.toHaveProperty('status');
  });

  it('al reemplazar, borra la foto que el update pisó', async () => {
    whenUploading({ previous: stored({ photo: PHOTO }) });

    await uploadMaterialPhoto(req(), mockRes(), mockNext());

    expect(storage.deleteObject).toHaveBeenCalledWith('old-key');
  });

  it('pide el documento anterior (new: false): con dos subidas a la vez, cada una borra la que de verdad pisó', async () => {
    whenUploading();

    await uploadMaterialPhoto(req(), mockRes(), mockNext());

    const [, , options] = vi.mocked(MaterialItem.findOneAndUpdate).mock.calls[0] as never[];
    expect(options).toEqual({ new: false });
  });

  it('si borran el material a mitad de camino, no deja la foto nueva huérfana', async () => {
    vi.mocked(MaterialItem.exists).mockResolvedValue({ _id: 'm1' } as never);
    vi.mocked(MaterialItem.findOneAndUpdate).mockResolvedValue(null as never);
    const next = mockNext();

    await uploadMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(404);
    expect(storage.deleteObject).toHaveBeenCalledWith('new-key');
  });

  it('si el storage no está configurado, dice 503 y no guarda nada', async () => {
    vi.mocked(MaterialItem.exists).mockResolvedValue({ _id: 'm1' } as never);
    vi.mocked(storage.uploadMaterialPhoto).mockRejectedValue(new storage.StorageNotConfiguredError());
    const next = mockNext();

    await uploadMaterialPhoto(req(), mockRes(), next);

    expect(thrownBy(next).status).toBe(503);
    expect(MaterialItem.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('si no puede borrar el archivo anterior, la foto nueva igual queda guardada', async () => {
    whenUploading({ previous: stored({ photo: PHOTO }) });
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
  /** Una respuesta que sí es un stream escribible, para que `pipeline` la pueda llenar. */
  function streamRes() {
    const chunks: Buffer[] = [];
    const res = new Writable({
      write(chunk, _encoding, done) {
        chunks.push(Buffer.from(chunk));
        done();
      },
    }) as unknown as Response & { headers: Record<string, string>; body: () => Buffer };
    res.headers = {};
    res.set = vi.fn((name: string, value: string) => {
      res.headers[name] = value;
      return res;
    }) as never;
    res.type = vi.fn().mockReturnValue(res) as never;
    res.body = () => Buffer.concat(chunks);
    return res;
  }

  const open = (bytes = 'jpeg-bytes', contentLength: number | null = bytes.length) =>
    vi.mocked(storage.openObject).mockResolvedValue({
      stream: Readable.from([Buffer.from(bytes)]),
      contentType: 'image/jpeg',
      contentLength,
    });

  it('sirve el archivo en streaming, con su tipo y largo, y sin dejar que el navegador lo reinterprete', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);
    open('jpeg-bytes');
    const res = streamRes();

    await getMaterialPhoto(req({ query: {} }), res, mockNext());

    expect(MaterialItem.findOne).toHaveBeenCalledWith({ _id: 'm1', project: 'project-1' });
    expect(storage.openObject).toHaveBeenCalledWith('old-key');
    expect(res.type).toHaveBeenCalledWith('image/jpeg');
    expect(res.headers['Content-Length']).toBe(String('jpeg-bytes'.length));
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(res.body().toString()).toBe('jpeg-bytes');
  });

  it('con ?v= la guarda para siempre (la URL es esa foto); sin versión, no', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);

    open();
    const versioned = streamRes();
    await getMaterialPhoto(req({ query: { v: '2026-10-24T10:00:00.000Z' } }), versioned, mockNext());
    expect(versioned.headers['Cache-Control']).toBe('private, max-age=31536000, immutable');

    open();
    const bare = streamRes();
    await getMaterialPhoto(req({ query: {} }), bare, mockNext());
    expect(bare.headers['Cache-Control']).toBe('private, no-cache');
  });

  it('un material sin foto es 404 y no va al storage', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored() as never);
    const next = mockNext();

    await getMaterialPhoto(req({ query: {} }), streamRes(), next);

    expect(thrownBy(next).status).toBe(404);
    expect(storage.openObject).not.toHaveBeenCalled();
  });

  it('un material de otra obra es 404', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(null as never);
    const next = mockNext();

    await getMaterialPhoto(req({ query: {} }), streamRes(), next);

    expect(thrownBy(next).status).toBe(404);
  });

  it('si el archivo ya no está en el storage, es 404', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);
    vi.mocked(storage.openObject).mockResolvedValue(null);
    const next = mockNext();

    await getMaterialPhoto(req({ query: {} }), streamRes(), next);

    expect(thrownBy(next).status).toBe(404);
  });

  it('si el stream se corta a mitad de la descarga, cierra la conexión en vez de responder JSON', async () => {
    vi.mocked(MaterialItem.findOne).mockResolvedValue(stored({ photo: PHOTO }) as never);
    vi.mocked(storage.openObject).mockResolvedValue({
      stream: new Readable({
        read() {
          this.push(Buffer.from('parcial'));
          this.destroy(new Error('conexión cortada'));
        },
      }),
      contentType: 'image/jpeg',
      contentLength: null,
    });
    const res = streamRes();
    // `headersSent` sólo se vuelve cierto en una respuesta HTTP real: acá se simula.
    Object.defineProperty(res, 'headersSent', { value: true });
    const destroy = vi.spyOn(res, 'destroy');
    const next = mockNext();

    await getMaterialPhoto(req({ query: {} }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalled();
  });
});
