import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

/**
 * Express 4 no atrapa el `throw` de un handler async: si el controller lanza sin
 * estar envuelto, el rechazo queda sin manejar y tira abajo la API. Acá se llama
 * al handler tal como lo monta el router y se comprueba que el error llega a
 * `next` en vez de escaparse.
 */
const addCustomSpecialty = vi.fn();
const updateCustomSpecialty = vi.fn();
vi.mock('../../services/custom-specialty.service.js', () => ({
  addCustomSpecialty: (...args: unknown[]) => addCustomSpecialty(...args),
  updateCustomSpecialty: (...args: unknown[]) => updateCustomSpecialty(...args),
}));

const { createProjectSpecialty, updateProjectSpecialty } = await import(
  '../../controllers/custom-specialty.controller.js'
);
const { conflict } = await import('../../utils/errors.js');

function run(handler: (req: Request, res: Response, next: NextFunction) => unknown, req: object) {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn();
  return Promise.resolve(handler({ project: { _id: 'p1' }, ...req } as Request, res, next)).then(() => ({ res, next }));
}

beforeEach(() => vi.clearAllMocks());

describe('createProjectSpecialty', () => {
  it('crea y responde 201', async () => {
    addCustomSpecialty.mockResolvedValue({ key: 'custom_x', label: 'X', archived: false });
    const { res, next } = await run(createProjectSpecialty, { body: { label: 'Yesería' } });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(next).not.toHaveBeenCalled();
  });

  it('un cuerpo inválido llega a next como error, no se escapa', async () => {
    const { next } = await run(createProjectSpecialty, { body: { label: '' } });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'VALIDATION' }));
  });

  it('un conflicto del servicio llega a next', async () => {
    addCustomSpecialty.mockRejectedValue(conflict('Ya existe una especialidad con ese nombre.'));
    const { next } = await run(createProjectSpecialty, { body: { label: 'Yesería' } });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }));
  });
});

describe('updateProjectSpecialty', () => {
  it('404 si la clave no es de la obra', async () => {
    updateCustomSpecialty.mockResolvedValue(null);
    const { next } = await run(updateProjectSpecialty, { params: { key: 'custom_zzz' }, body: { archived: true } });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'NOT_FOUND' }));
  });

  it('un nombre repetido llega a next como conflicto', async () => {
    updateCustomSpecialty.mockRejectedValue(conflict('Ya existe una especialidad con ese nombre.'));
    const { next } = await run(updateProjectSpecialty, { params: { key: 'custom_a' }, body: { label: 'Gas' } });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'CONFLICT' }));
  });
});
