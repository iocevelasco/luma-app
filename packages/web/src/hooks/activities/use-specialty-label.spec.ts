import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { specialtyLabelFor } from './use-specialty-label';

const t = ((key: string) => `T(${key})`) as unknown as TFunction;
const custom = [{ key: 'custom_yeseria', label: 'Yesería fina', archived: false }];

describe('specialtyLabelFor', () => {
  it('una de base sale de i18n', () => {
    expect(specialtyLabelFor('pintura', custom, t)).toBe('T(provider.specialty.pintura)');
  });

  it('una propia sale del nombre que le puso el gerente', () => {
    expect(specialtyLabelFor('custom_yeseria', custom, t)).toBe('Yesería fina');
  });

  it('sin la obra a mano, una propia se lee desde su clave y no como un texto genérico', () => {
    expect(specialtyLabelFor('custom_yeseria_fina', undefined, t)).toBe('Yeseria fina');
    expect(specialtyLabelFor('custom_otra', custom, t)).toBe('Otra');
  });
});
