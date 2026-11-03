import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateOne = vi.fn();
const findById = vi.fn();
vi.mock('../../models/Project.js', () => ({
  Project: {
    updateOne: (...args: unknown[]) => updateOne(...args),
    findById: (...args: unknown[]) => findById(...args),
  },
}));

import type { IProject } from '../../models/Project.js';
import {
  addCustomSpecialty,
  isSelectableSpecialty,
  updateCustomSpecialty,
} from '../../services/custom-specialty.service.js';

function project(customSpecialties: IProject['customSpecialties'] = []): IProject {
  return { _id: 'p1', customSpecialties } as unknown as IProject;
}

/** `findById(...).select(...).lean()` devolviendo la obra de ahora. */
function freshProject(customSpecialties: IProject['customSpecialties']) {
  findById.mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ customSpecialties }) }) });
}

beforeEach(() => {
  updateOne.mockReset().mockResolvedValue({ modifiedCount: 1 });
  findById.mockReset();
});

describe('addCustomSpecialty', () => {
  it('genera la clave desde el nombre, sin tildes ni espacios', async () => {
    const created = await addCustomSpecialty(project(), '  Yesería fina ');
    expect(created).toEqual({ key: 'custom_yeseria_fina', label: 'Yesería fina', archived: false });
  });

  it('decide duplicado y tope en la misma escritura, no con la copia vieja', async () => {
    await addCustomSpecialty(project(), 'Yesería');
    const [filter] = updateOne.mock.calls[0] as [Record<string, unknown>];
    expect(filter['customSpecialties.key']).toEqual({ $ne: 'custom_yeseria' });
    expect(filter['customSpecialties.99']).toEqual({ $exists: false });
  });

  it('si otra escritura se adelantó con el mismo nombre, responde conflicto', async () => {
    updateOne.mockResolvedValue({ modifiedCount: 0 });
    freshProject([{ key: 'custom_yeseria', label: 'Yesería', archived: false }]);
    await expect(addCustomSpecialty(project(), 'Yesería')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('si la obra se llenó mientras tanto, responde conflicto por el tope', async () => {
    updateOne.mockResolvedValue({ modifiedCount: 0 });
    freshProject([]);
    await expect(addCustomSpecialty(project(), 'Una más')).rejects.toMatchObject({
      code: 'CONFLICT',
      message: expect.stringContaining('100'),
    });
  });

  it('rechaza el nombre de una de base: por clave y por nombre visible', async () => {
    for (const label of ['Diseño', 'drywall', 'Sistema contra incendio', 'Pisos y revestimientos', 'Techos e impermeabilización', 'REDES (CCTV, internet, domótica)']) {
      await expect(addCustomSpecialty(project(), label), label).rejects.toMatchObject({ code: 'CONFLICT' });
    }
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('rechaza un nombre sin letras ni números', async () => {
    await expect(addCustomSpecialty(project(), '¡¡¡')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('updateCustomSpecialty', () => {
  const p = project([
    { key: 'custom_a', label: 'Alfa', archived: false },
    { key: 'custom_b', label: 'Beta', archived: false },
  ]);

  it('devuelve null si la clave no es de la obra', async () => {
    expect(await updateCustomSpecialty(p, 'custom_zzz', { archived: true })).toBeNull();
  });

  it('no deja renombrar a un nombre que ya tiene otra, ni al de una de base', async () => {
    await expect(updateCustomSpecialty(p, 'custom_a', { label: 'beta' })).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(updateCustomSpecialty(p, 'custom_a', { label: 'Gas' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('permite guardar con el mismo nombre y archiva sin tocar la clave', async () => {
    expect(await updateCustomSpecialty(p, 'custom_a', { label: 'ALFA' })).toMatchObject({ key: 'custom_a', label: 'ALFA' });
    expect(await updateCustomSpecialty(p, 'custom_b', { archived: true })).toEqual({ key: 'custom_b', label: 'Beta', archived: true });
  });
});

describe('isSelectableSpecialty', () => {
  const p = project([
    { key: 'custom_a', label: 'Alfa', archived: false },
    { key: 'custom_b', label: 'Beta', archived: true },
  ]);

  it('las de base siempre se pueden elegir', () => expect(isSelectableSpecialty(p, 'pintura')).toBe(true));
  it('una propia de la obra, sí', () => expect(isSelectableSpecialty(p, 'custom_a')).toBe(true));
  it('una archivada, no', () => expect(isSelectableSpecialty(p, 'custom_b')).toBe(false));
  it('una propia de otra obra, no', () => expect(isSelectableSpecialty(p, 'custom_otra')).toBe(false));
});
