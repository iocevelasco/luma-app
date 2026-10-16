import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canInProject,
  MILESTONE_ATTACHMENTS_MAX,
  type Capability,
  type ProjectRole,
} from '@luma/shared';
import type { Request, Response } from 'express';

/**
 * Lo que no vive en Zod: el tipo de archivo, el tope por hito, quién puede
 * tocar los adjuntos de un hito ya publicado, que la `key` del bucket nunca
 * salga en la respuesta y que un archivo no quede huérfano si el hito no lo
 * pudo registrar.
 */
vi.mock('../../models/Milestone.js', () => ({ Milestone: { findOne: vi.fn() } }));
vi.mock('../../models/Activity.js', () => ({ Activity: { findById: vi.fn() } }));
vi.mock('../../models/User.js', () => ({ User: { findById: vi.fn() } }));
vi.mock('../../services/notification.service.js', () => ({ notifyProject: vi.fn() }));
vi.mock('../../services/storage.service.js', () => ({
  StorageNotConfiguredError: class StorageNotConfiguredError extends Error {},
  uploadMilestoneAttachment: vi.fn(),
  deleteObject: vi.fn(),
  signObjectUrl: vi.fn(),
}));

const { Milestone } = await import('../../models/Milestone.js');
const { User } = await import('../../models/User.js');
const storage = await import('../../services/storage.service.js');
const { addMilestoneAttachment, removeMilestoneAttachment } = await import(
  '../../controllers/milestone-attachment.controller.js'
);

interface FakeAttachment {
  _id: string;
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
  deleteOne: () => void;
}

function fakeAttachments(count = 0) {
  const arr = Array.from({ length: count }, (_, index) =>
    attachment(`att-${index}`),
  ) as FakeAttachment[] & { id: (id: string) => FakeAttachment | undefined };

  function attachment(id: string, data: Partial<FakeAttachment> = {}): FakeAttachment {
    const item: FakeAttachment = {
      _id: id,
      key: `bucket-key-${id}`,
      fileName: `${id}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: 1000,
      createdAt: new Date('2026-10-15T10:00:00.000Z'),
      ...data,
      deleteOne: () => {
        const index = arr.indexOf(item);
        if (index !== -1) arr.splice(index, 1);
      },
    };
    return item;
  }

  const push = arr.push.bind(arr);
  arr.push = vi.fn((data: Partial<FakeAttachment>) => push(attachment('new-att', data)));
  arr.id = (id: string) => arr.find((item) => item._id === id);
  return arr;
}

function fakeMilestone(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'milestone-1',
    project: 'project-1',
    type: 'vicio_oculto',
    audience: 'interno',
    severity: 'critico',
    title: 'Humedad en el muro',
    occurredOn: '2026-10-12',
    attendees: [],
    attachments: fakeAttachments(),
    activity: null,
    reportedBy: 'gerente-1',
    createdAt: new Date('2026-10-12T10:00:00.000Z'),
    updatedAt: new Date('2026-10-12T10:00:00.000Z'),
    save: vi.fn(),
    ...overrides,
  };
}

function canFor(role: ProjectRole) {
  return (capability: Capability) =>
    canInProject(role, capability, { providersVisibleToClient: false });
}

const PHOTO = {
  originalname: 'humedad.jpg',
  mimetype: 'image/jpeg',
  size: 2048,
  buffer: Buffer.from('foto'),
};

function reqFor(
  role: ProjectRole,
  { file, params = {} }: { file?: unknown; params?: object } = {},
) {
  return {
    user: { sub: `${role}-1` },
    project: { _id: 'project-1' },
    can: canFor(role),
    params: { milestoneId: 'milestone-1', ...params },
    body: {},
    file,
  } as unknown as Request;
}

/** Corre un handler envuelto y devuelve lo que respondió o el error que lanzó. */
function run(
  handler: (req: Request, res: Response, next: (error?: unknown) => void) => void,
  req: Request,
) {
  return new Promise<{
    status?: number;
    body?: { data: { milestone: unknown } };
    error?: { code: string };
  }>((resolve) => {
    const res = {} as Response;
    let status = 200;
    res.status = vi.fn((code: number) => {
      status = code;
      return res;
    }) as never;
    res.json = vi.fn((body) => {
      resolve({ status, body });
      return res;
    }) as never;
    handler(req, res, (error) => resolve({ error: error as { code: string } }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(User.findById).mockReturnValue({
    select: vi.fn().mockResolvedValue({ name: 'Gerente' }),
  } as never);
  vi.mocked(storage.signObjectUrl).mockResolvedValue('https://media.test/firmada');
  vi.mocked(storage.deleteObject).mockResolvedValue(undefined);
  vi.mocked(storage.uploadMilestoneAttachment).mockResolvedValue({ key: 'bucket-key-new' });
});

describe('addMilestoneAttachment', () => {
  it('sube la foto, la registra y responde el hito sin la key del bucket', async () => {
    const milestone = fakeMilestone();
    vi.mocked(Milestone.findOne).mockResolvedValue(milestone as never);

    const { status, body } = await run(addMilestoneAttachment, reqFor('gerente', { file: PHOTO }));

    expect(status).toBe(201);
    expect(milestone.save).toHaveBeenCalled();
    expect(milestone.attachments).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain('bucket-key');
    expect(JSON.stringify(body)).toContain('https://media.test/firmada');
  });

  it('el supervisor adjunta evidencia a su eventualidad interna', async () => {
    vi.mocked(Milestone.findOne).mockResolvedValue(fakeMilestone() as never);

    const { status } = await run(addMilestoneAttachment, reqFor('supervisor', { file: PHOTO }));

    expect(status).toBe(201);
  });

  it('el supervisor no toca los adjuntos de un hito publicado al cliente', async () => {
    vi.mocked(Milestone.findOne).mockResolvedValue(fakeMilestone({ audience: 'cliente' }) as never);

    const { error } = await run(addMilestoneAttachment, reqFor('supervisor', { file: PHOTO }));

    expect(error?.code).toBe('FORBIDDEN');
    expect(storage.uploadMilestoneAttachment).not.toHaveBeenCalled();
  });

  it('rechaza un formato que no se puede mostrar', async () => {
    const docx = { ...PHOTO, originalname: 'acta.docx', mimetype: 'application/msword' };

    const { error } = await run(addMilestoneAttachment, reqFor('gerente', { file: docx }));

    expect(error?.code).toBe('VALIDATION');
    expect(storage.uploadMilestoneAttachment).not.toHaveBeenCalled();
  });

  it(`rechaza el adjunto número ${MILESTONE_ATTACHMENTS_MAX + 1}`, async () => {
    vi.mocked(Milestone.findOne).mockResolvedValue(
      fakeMilestone({ attachments: fakeAttachments(MILESTONE_ATTACHMENTS_MAX) }) as never,
    );

    const { error } = await run(addMilestoneAttachment, reqFor('gerente', { file: PHOTO }));

    expect(error?.code).toBe('VALIDATION');
    expect(storage.uploadMilestoneAttachment).not.toHaveBeenCalled();
  });

  it('503 con mensaje propio si el storage no está configurado', async () => {
    vi.mocked(Milestone.findOne).mockResolvedValue(fakeMilestone() as never);
    vi.mocked(storage.uploadMilestoneAttachment).mockRejectedValue(
      new storage.StorageNotConfiguredError(),
    );

    const { error } = await run(addMilestoneAttachment, reqFor('gerente', { file: PHOTO }));

    expect(error?.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('si el hito no lo pudo registrar, borra el archivo que ya subió', async () => {
    const milestone = fakeMilestone();
    milestone.save.mockRejectedValue(new Error('mongo caído'));
    vi.mocked(Milestone.findOne).mockResolvedValue(milestone as never);

    const { error } = await run(addMilestoneAttachment, reqFor('gerente', { file: PHOTO }));

    expect(error).toBeInstanceOf(Error);
    expect(storage.deleteObject).toHaveBeenCalledWith('bucket-key-new');
  });

  it('404 si el hito no es de esta obra', async () => {
    vi.mocked(Milestone.findOne).mockResolvedValue(null as never);

    const { error } = await run(addMilestoneAttachment, reqFor('gerente', { file: PHOTO }));

    expect(error?.code).toBe('NOT_FOUND');
  });
});

describe('removeMilestoneAttachment', () => {
  it('lo saca del hito y lo borra del bucket', async () => {
    const milestone = fakeMilestone({ attachments: fakeAttachments(2) });
    vi.mocked(Milestone.findOne).mockResolvedValue(milestone as never);

    const { status } = await run(
      removeMilestoneAttachment,
      reqFor('gerente', { params: { attachmentId: 'att-0' } }),
    );

    expect(status).toBe(200);
    expect(milestone.attachments.map((item) => item._id)).toEqual(['att-1']);
    expect(storage.deleteObject).toHaveBeenCalledWith('bucket-key-att-0');
  });

  it('404 si el adjunto no es de ese hito', async () => {
    vi.mocked(Milestone.findOne).mockResolvedValue(fakeMilestone() as never);

    const { error } = await run(
      removeMilestoneAttachment,
      reqFor('gerente', { params: { attachmentId: 'ajeno' } }),
    );

    expect(error?.code).toBe('NOT_FOUND');
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });
});
