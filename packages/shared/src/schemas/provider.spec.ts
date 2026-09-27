import { describe, expect, it } from 'vitest';
import { createProviderSchema, updateProviderSchema } from './provider.js';

const validProvider = {
  name: 'Juan Pérez',
  specialty: 'electricidad',
  phone: '+54 9 11 5555-5555',
};

describe('createProviderSchema', () => {
  it('acepta un proveedor válido', () => {
    expect(createProviderSchema.safeParse(validProvider).success).toBe(true);
  });

  it('rechaza specialty fuera del enum', () => {
    const result = createProviderSchema.safeParse({ ...validProvider, specialty: 'jardin' });
    expect(result.success).toBe(false);
  });

  it('rechaza sin teléfono', () => {
    const result = createProviderSchema.safeParse({ ...validProvider, phone: '' });
    expect(result.success).toBe(false);
  });

  it('exige customSpecialty cuando specialty es "otra"', () => {
    const result = createProviderSchema.safeParse({ ...validProvider, specialty: 'otra' });
    expect(result.success).toBe(false);
  });

  it('acepta "otra" con customSpecialty', () => {
    const result = createProviderSchema.safeParse({
      ...validProvider,
      specialty: 'otra',
      customSpecialty: 'Impermeabilización de techos',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza email inválido', () => {
    const result = createProviderSchema.safeParse({ ...validProvider, email: 'no-es-un-email' });
    expect(result.success).toBe(false);
  });

  it('acepta email vacío (opcional)', () => {
    const result = createProviderSchema.safeParse({ ...validProvider, email: '' });
    expect(result.success).toBe(true);
  });
});

describe('updateProviderSchema', () => {
  it('acepta un update parcial', () => {
    expect(updateProviderSchema.safeParse({ name: 'Nuevo nombre' }).success).toBe(true);
  });

  it('acepta desactivar un proveedor', () => {
    expect(updateProviderSchema.safeParse({ active: false }).success).toBe(true);
  });

  it('exige customSpecialty si cambia specialty a "otra"', () => {
    const result = updateProviderSchema.safeParse({ specialty: 'otra' });
    expect(result.success).toBe(false);
  });

  it('no exige customSpecialty si specialty no cambia', () => {
    const result = updateProviderSchema.safeParse({ phone: '11-4444-4444' });
    expect(result.success).toBe(true);
  });
});
