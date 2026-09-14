import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

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
  MaterialItem: { create: vi.fn(), findOne: vi.fn(), findOneAndDelete: vi.fn() },
}));

const { Activity } = await import('../../models/Activity.js');
const { MaterialItem } = await import('../../models/MaterialItem.js');
const { createMaterial } = await import('../../controllers/material.controller.js');

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

    await createMaterial(req, res);

    expect(Activity.findOne).toHaveBeenCalledWith({
      _id: 'activity-de-otra-obra',
      project: 'project-1',
    });
    expect(res.status).toHaveBeenCalledWith(400);
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

    await createMaterial(req, res);

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

    await createMaterial(req, res);

    expect(Activity.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
