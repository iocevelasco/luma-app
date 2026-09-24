import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no puede vivir en Zod: validación de tipo de archivo, el 503
 * explícito cuando el storage no está configurado (en vez de un 500 opaco), y
 * que borrar una foto que no existe en esa actividad da 404. Mismo patrón de
 * mocking que `labor.controller.spec.ts`.
 */
vi.mock('../../models/Activity.js', () => ({
  Activity: { findOne: vi.fn() },
}));
vi.mock('../../services/storage.service.js', () => ({
  StorageNotConfiguredError: class StorageNotConfiguredError extends Error {},
  uploadEvidencePhoto: vi.fn(),
  deleteEvidencePhoto: vi.fn(),
  signEvidencePhotoUrl: vi.fn(),
}));

const { Activity } = await import('../../models/Activity.js');
const { uploadEvidencePhoto, deleteEvidencePhoto, signEvidencePhotoUrl, StorageNotConfiguredError } =
  await import('../../services/storage.service.js');
const { uploadActivityEvidence, deleteActivityEvidence } = await import(
  '../../controllers/activity.controller.js'
);

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

interface FakeEvidenceItem {
  _id: string;
  key: string;
  uploadedBy: string;
  uploadedAt: Date;
  deleteOne: () => void;
}

function fakeEvidenceArray(initial: FakeEvidenceItem[] = []) {
  const arr = [...initial] as FakeEvidenceItem[] & {
    push: (item: Omit<FakeEvidenceItem, '_id' | 'deleteOne'>) => number;
    id: (id: string) => FakeEvidenceItem | undefined;
  };
  arr.push = vi.fn((item) => {
    const withId: FakeEvidenceItem = {
      ...item,
      _id: 'new-photo-id',
      deleteOne: () => {
        const index = arr.findIndex((e) => e._id === withId._id);
        if (index !== -1) arr.splice(index, 1);
      },
    };
    Array.prototype.push.call(arr, withId);
    return arr.length;
  });
  arr.id = vi.fn((id) => arr.find((e) => e._id === id));
  return arr;
}

function fakeActivity(evidence: FakeEvidenceItem[] = []) {
  return {
    _id: 'activity-1',
    project: 'project-1',
    name: 'Contrapiso',
    area: 'Planta baja',
    startDate: '2026-01-01',
    endDate: '2026-01-05',
    responsible: { name: 'Juan Pérez' },
    status: 'en_curso',
    evidence: fakeEvidenceArray(evidence),
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    user: { sub: 'user-1' },
    project: { _id: 'project-1' },
    params: { activityId: 'activity-1' },
    file: {
      buffer: Buffer.from('fake'),
      mimetype: 'image/jpeg',
      originalname: 'foto.jpg',
    },
    ...overrides,
  } as unknown as Request;
}

describe('uploadActivityEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signEvidencePhotoUrl).mockResolvedValue('https://signed.example/foto.jpg');
  });

  it('400 si no viene archivo', async () => {
    const req = mockReq({ file: undefined });
    const res = mockRes();

    await uploadActivityEvidence(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadEvidencePhoto).not.toHaveBeenCalled();
  });

  it('400 si el formato no está permitido', async () => {
    const req = mockReq({ file: { buffer: Buffer.from('x'), mimetype: 'application/pdf' } });
    const res = mockRes();

    await uploadActivityEvidence(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(uploadEvidencePhoto).not.toHaveBeenCalled();
  });

  it('404 si la actividad no pertenece a esa obra', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue(null as never);
    const req = mockReq();
    const res = mockRes();

    await uploadActivityEvidence(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('503 (no 500) si el storage no está configurado', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue(fakeActivity() as never);
    vi.mocked(uploadEvidencePhoto).mockRejectedValue(new StorageNotConfiguredError());
    const req = mockReq();
    const res = mockRes();

    await uploadActivityEvidence(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('sube la foto y devuelve la actividad con la URL firmada', async () => {
    const activity = fakeActivity();
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    vi.mocked(uploadEvidencePhoto).mockResolvedValue({ key: 'evidence/project-1/activity-1/x.jpg' });
    const req = mockReq();
    const res = mockRes();

    await uploadActivityEvidence(req, res);

    expect(uploadEvidencePhoto).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'project-1', activityId: 'activity-1', extension: '.jpg' }),
    );
    expect(activity.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    const [{ activity: dto }] = (res.json as ReturnType<typeof vi.fn>).mock.calls[0].map(
      (arg: { data: { activity: { evidence: unknown[] } } }) => arg.data,
    );
    expect(dto.evidence).toHaveLength(1);
    expect(dto.evidence[0]).toMatchObject({ url: 'https://signed.example/foto.jpg' });
  });
});

describe('deleteActivityEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signEvidencePhotoUrl).mockResolvedValue('https://signed.example/foto.jpg');
  });

  it('404 si la foto no existe en esa actividad', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue(fakeActivity() as never);
    const req = mockReq({ params: { activityId: 'activity-1', evidenceId: 'no-existe' } });
    const res = mockRes();

    await deleteActivityEvidence(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(deleteEvidencePhoto).not.toHaveBeenCalled();
  });

  it('borra la foto del storage y del array de la actividad', async () => {
    const existing: FakeEvidenceItem = {
      _id: 'photo-1',
      key: 'evidence/project-1/activity-1/photo-1.jpg',
      uploadedBy: 'user-1',
      uploadedAt: new Date(),
      deleteOne: vi.fn(),
    };
    const activity = fakeActivity([existing]);
    existing.deleteOne = () => {
      const index = activity.evidence.findIndex((e) => e._id === 'photo-1');
      if (index !== -1) activity.evidence.splice(index, 1);
    };
    vi.mocked(Activity.findOne).mockResolvedValue(activity as never);
    const req = mockReq({ params: { activityId: 'activity-1', evidenceId: 'photo-1' } });
    const res = mockRes();

    await deleteActivityEvidence(req, res);

    expect(deleteEvidencePhoto).toHaveBeenCalledWith('evidence/project-1/activity-1/photo-1.jpg');
    expect(activity.save).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(404);
  });
});
