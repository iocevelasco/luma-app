import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateOne = vi.fn().mockResolvedValue({});
vi.mock('../../models/Project.js', () => ({ Project: { updateOne: (...args: unknown[]) => updateOne(...args) } }));

import type { IProject } from '../../models/Project.js';
import {
  addCustomSpecialty,
  isSelectableSpecialty,
  updateCustomSpecialty,
} from '../../services/custom-specialty.service.js';

function project(customSpecialties: IProject['customSpecialties'] = []): IProject {
  return { _id: 'p1', customSpecialties } as unknown as IProject;
}

beforeEach(() => updateOne.mockClear());

describe('addCustomSpecialty', () => {
  it('genera la clave desde el nombre, sin tildes ni espacios', async () => {
    const created = await addCustomSpecialty(project(), '  Yesería fina ');
    expect(created).toEqual({ key: 'custom_yeseria_fina', label: 'Yesería fina', archived: false });
    expect(updateOne).toHaveBeenCalledOnce();
  });

  it('rechaza un nombre repetido sin distinguir mayúsculas ni tildes', async () => {
    const p = project([{ key: 'custom_yeseria', label: 'Yesería', archived: false }]);
    await expect(addCustomSpecialty(p, 'YESERIA')).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(updateOne).not.toHaveBeenCalled();
  });

  it('rechaza el nombre de una de base', async () => {
    await expect(addCustomSpecialty(project(), 'Diseño')).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(addCustomSpecialty(project(), 'drywall')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rechaza un nombre sin letras ni números', async () => {
    await expect(addCustomSpecialty(project(), '¡¡¡')).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('respeta el tope por obra', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ key: `custom_x${i}`, label: `X${i}`, archived: false }));
    await expect(addCustomSpecialty(project(full), 'Una más')).rejects.toMatchObject({ code: 'CONFLICT' });
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

  it('no deja renombrar a un nombre que ya tiene otra', async () => {
    await expect(updateCustomSpecialty(p, 'custom_a', { label: 'beta' })).rejects.toMatchObject({ code: 'CONFLICT' });
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
