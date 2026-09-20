import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no puede vivir en Zod: `activityId` tiene que pertenecer al
 * mismo `project`, y el upsert por (activity, date) nunca pisa `createdBy` en
 * una actualización — mismo patrón que `material.controller.spec.ts`.
 */
vi.mock('../../models/Activity.js', () => ({
  Activity: { findOne: vi.fn() },
}));
vi.mock('../../models/LaborRecord.js', () => ({
  LaborRecord: { findOneAndUpdate: vi.fn() },
}));

const { Activity } = await import('../../models/Activity.js');
const { LaborRecord } = await import('../../models/LaborRecord.js');
const { upsertLaborRecord } = await import('../../controllers/labor.controller.js');

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
      activityId: 'activity-1',
      date: '2026-09-15',
      expectedCount: 4,
      ...overrides,
    },
  } as unknown as Request;
}

describe('upsertLaborRecord', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400 si la actividad no pertenece a esa obra', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue(null);
    const req = mockReq({ activityId: 'activity-de-otra-obra' });
    const res = mockRes();

    await upsertLaborRecord(req, res);

    expect(Activity.findOne).toHaveBeenCalledWith({
      _id: 'activity-de-otra-obra',
      project: 'project-1',
    });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(LaborRecord.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('hace upsert por (activity, date) sin pisar createdBy en un update', async () => {
    vi.mocked(Activity.findOne).mockResolvedValue({ _id: 'activity-1' } as never);
    vi.mocked(LaborRecord.findOneAndUpdate).mockResolvedValue({
      _id: 'lr1',
      project: 'project-1',
      activity: 'activity-1',
      date: '2026-09-15',
      expectedCount: 4,
      presentNames: ['Juan Pérez'],
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
    const req = mockReq({ presentNames: ['Juan Pérez'] });
    const res = mockRes();

    await upsertLaborRecord(req, res);

    expect(LaborRecord.findOneAndUpdate).toHaveBeenCalledWith(
      { project: 'project-1', activity: 'activity-1', date: '2026-09-15' },
      {
        $set: { expectedCount: 4, presentNames: ['Juan Pérez'] },
        $setOnInsert: {
          project: 'project-1',
          activity: 'activity-1',
          date: '2026-09-15',
          createdBy: 'user-1',
        },
      },
      { new: true, upsert: true },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('rechaza expectedCount inválido antes de tocar la base', async () => {
    const req = mockReq({ expectedCount: -1 });
    const res = mockRes();

    await upsertLaborRecord(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Activity.findOne).not.toHaveBeenCalled();
  });
});
