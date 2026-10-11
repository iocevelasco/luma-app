import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no puede vivir en Zod: validación del tipo de archivo, el 503
 * explícito cuando el storage no está configurado (en vez de un 500 opaco),
 * que el archivo se borre del bucket junto con el documento, y que la `key`
 * interna nunca salga en una respuesta. Mismo patrón de mocking que
 * `activity-evidence.controller.spec.ts`.
 */
vi.mock('../../models/ProjectDocument.js', () => ({
  ProjectDocument: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));
vi.mock('../../models/User.js', () => ({
  User: { find: vi.fn(), findById: vi.fn() },
}));
vi.mock('../../services/storage.service.js', () => ({
  StorageNotConfiguredError: class StorageNotConfiguredError extends Error {},
  uploadProjectDocument: vi.fn(),
  deleteObject: vi.fn(),
  signObjectUrl: vi.fn(),
}));

const { ProjectDocument } = await import('../../models/ProjectDocument.js');
const { User } = await import('../../models/User.js');
const { uploadProjectDocument, deleteObject, signObjectUrl, StorageNotConfiguredError } =
  await import('../../services/storage.service.js');
const {
  createProjectDocument,
  deleteProjectDocument,
  listProjectDocuments,
  updateProjectDocument,
} = await import('../../controllers/document.controller.js');

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function fakeDoc(overrides: Record<string, unknown> = {}) {
  const doc = {
    _id: 'doc-1',
    project: 'project-1',
    category: 'permiso_edificio',
    title: 'Permiso de la torre',
    space: undefined,
    notes: undefined,
    key: 'documents/project-1/abc.pdf',
    fileName: 'permiso.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    uploadedBy: 'user-1',
    createdAt: new Date('2026-09-01T10:00:00.000Z'),
    updatedAt: new Date('2026-09-01T10:00:00.000Z'),
    set: vi.fn(),
    save: vi.fn(),
    ...overrides,
  };
  return doc;
}

function pdfUpload(body: Record<string, string> = {}): Request {
  return {
    user: { sub: 'user-1' },
    project: { _id: 'project-1' },
    file: {
      mimetype: 'application/pdf',
      originalname: 'permiso.pdf',
      size: 1024,
      buffer: Buffer.from('x'),
    },
    body: { category: 'permiso_edificio', title: 'Permiso de la torre', ...body },
  } as unknown as Request;
}

function mockUserLookups(name = 'Gerente') {
  vi.mocked(User.findById).mockReturnValue({
    select: vi.fn().mockResolvedValue({ _id: 'user-1', name }),
  } as never);
  vi.mocked(User.find).mockReturnValue({
    select: vi.fn().mockResolvedValue([{ _id: 'user-1', name }]),
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUserLookups();
  vi.mocked(signObjectUrl).mockResolvedValue('https://bucket.example/firmada');
  vi.mocked(uploadProjectDocument).mockResolvedValue({ key: 'documents/project-1/abc.pdf' });
});

describe('createProjectDocument', () => {
  it('400 si no vino archivo', async () => {
    const req = { ...pdfUpload(), file: undefined } as unknown as Request;
    const res = mockRes();

    await createProjectDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProjectDocument.create).not.toHaveBeenCalled();
  });

  it('400 si el formato no está soportado', async () => {
    // Un .dwg de AutoCAD entra por acá: el navegador no lo puede mostrar, así
    // que el error tiene que ser explícito y no un archivo que nadie abre.
    const req = pdfUpload();
    (req as unknown as { file: { mimetype: string } }).file.mimetype =
      'application/acad';
    const res = mockRes();

    await createProjectDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadProjectDocument).not.toHaveBeenCalled();
  });

  it('400 si la categoría no es una de la matriz', async () => {
    const res = mockRes();

    await createProjectDocument(pdfUpload({ category: 'contrato' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadProjectDocument).not.toHaveBeenCalled();
  });

  it('no sube nada al bucket si la ficha es inválida', async () => {
    // El orden importa: validar después de subir deja basura en el bucket
    // cada vez que alguien manda un título vacío.
    const res = mockRes();

    await createProjectDocument(pdfUpload({ title: '   ' }), res);

    expect(uploadProjectDocument).not.toHaveBeenCalled();
  });

  it('503 explícito si el storage no está configurado', async () => {
    vi.mocked(uploadProjectDocument).mockRejectedValue(new StorageNotConfiguredError());
    const res = mockRes();

    await createProjectDocument(pdfUpload(), res);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('guarda y responde 201 sin exponer la key interna', async () => {
    vi.mocked(ProjectDocument.create).mockResolvedValue(fakeDoc() as never);
    const res = mockRes();

    await createProjectDocument(pdfUpload(), res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = vi.mocked(res.json).mock.calls[0][0] as {
      data: { document: Record<string, unknown> };
    };
    expect(payload.data.document).not.toHaveProperty('key');
    expect(payload.data.document.url).toBe('https://bucket.example/firmada');
    expect(payload.data.document.uploadedByName).toBe('Gerente');
  });
});

describe('listProjectDocuments', () => {
  it('firma cada documento al vuelo y resuelve quién lo subió', async () => {
    vi.mocked(ProjectDocument.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([fakeDoc(), fakeDoc({ _id: 'doc-2' })]),
    } as never);
    const res = mockRes();

    await listProjectDocuments({ project: { _id: 'project-1' } } as unknown as Request, res);

    const payload = vi.mocked(res.json).mock.calls[0][0] as {
      data: { documents: Record<string, unknown>[] };
    };
    expect(payload.data.documents).toHaveLength(2);
    expect(signObjectUrl).toHaveBeenCalledTimes(2);
    // Una sola consulta de usuarios para toda la lista, no una por documento.
    expect(User.find).toHaveBeenCalledTimes(1);
  });

  it('un documento sin storage configurado sale con url null, no rompe la lista', async () => {
    vi.mocked(signObjectUrl).mockResolvedValue(null);
    vi.mocked(ProjectDocument.find).mockReturnValue({
      sort: vi.fn().mockResolvedValue([fakeDoc()]),
    } as never);
    const res = mockRes();

    await listProjectDocuments({ project: { _id: 'project-1' } } as unknown as Request, res);

    const payload = vi.mocked(res.json).mock.calls[0][0] as {
      data: { documents: { url: string | null }[] };
    };
    expect(payload.data.documents[0].url).toBeNull();
  });
});

describe('updateProjectDocument', () => {
  it('404 si el documento no es de esta obra', async () => {
    vi.mocked(ProjectDocument.findOne).mockResolvedValue(null as never);
    const res = mockRes();

    await updateProjectDocument(
      {
        project: { _id: 'project-1' },
        params: { documentId: 'doc-9' },
        body: { title: 'Otro' },
      } as unknown as Request,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400 si el body no trae ningún campo', async () => {
    const res = mockRes();

    await updateProjectDocument(
      {
        project: { _id: 'project-1' },
        params: { documentId: 'doc-1' },
        body: {},
      } as unknown as Request,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProjectDocument.findOne).not.toHaveBeenCalled();
  });

  it('edita la ficha y nunca toca el archivo', async () => {
    const doc = fakeDoc();
    vi.mocked(ProjectDocument.findOne).mockResolvedValue(doc as never);
    const res = mockRes();

    await updateProjectDocument(
      {
        project: { _id: 'project-1' },
        params: { documentId: 'doc-1' },
        body: { title: 'Permiso actualizado' },
      } as unknown as Request,
      res,
    );

    expect(doc.set).toHaveBeenCalledWith({ title: 'Permiso actualizado' });
    expect(doc.save).toHaveBeenCalled();
    expect(uploadProjectDocument).not.toHaveBeenCalled();
    expect(deleteObject).not.toHaveBeenCalled();
  });
});

describe('deleteProjectDocument', () => {
  it('404 si el documento no es de esta obra', async () => {
    vi.mocked(ProjectDocument.findOne).mockResolvedValue(null as never);
    const res = mockRes();

    await deleteProjectDocument(
      { project: { _id: 'project-1' }, params: { documentId: 'doc-9' } } as unknown as Request,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(deleteObject).not.toHaveBeenCalled();
  });

  it('borra el archivo del bucket además del documento', async () => {
    // Sin esto cada borrado deja un objeto huérfano pagándose solo para siempre.
    const doc = fakeDoc();
    vi.mocked(ProjectDocument.findOne).mockResolvedValue(doc as never);
    const res = mockRes();

    await deleteProjectDocument(
      { project: { _id: 'project-1' }, params: { documentId: 'doc-1' } } as unknown as Request,
      res,
    );

    expect(deleteObject).toHaveBeenCalledWith('documents/project-1/abc.pdf');
    expect(ProjectDocument.findByIdAndDelete).toHaveBeenCalledWith('doc-1');
  });
});
