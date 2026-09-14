import { describe, expect, it } from 'vitest';
import { createMaterialSchema, updateMaterialSchema } from './material.js';

const validMaterial = {
  name: 'Cemento',
  quantity: 10,
  unit: 'bolsa' as const,
};

describe('createMaterialSchema', () => {
  it('acepta un material válido', () => {
    expect(createMaterialSchema.safeParse(validMaterial).success).toBe(true);
  });

  it('default de status es pendiente', () => {
    const result = createMaterialSchema.safeParse(validMaterial);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('pendiente');
  });

  it('rechaza quantity <= 0', () => {
    expect(createMaterialSchema.safeParse({ ...validMaterial, quantity: 0 }).success).toBe(false);
    expect(createMaterialSchema.safeParse({ ...validMaterial, quantity: -5 }).success).toBe(false);
  });

  it('rechaza unit fuera del enum cerrado', () => {
    const result = createMaterialSchema.safeParse({ ...validMaterial, unit: 'litro' });
    expect(result.success).toBe(false);
  });

  it('acepta las 9 unidades', () => {
    const units = ['un', 'm', 'm2', 'm3', 'kg', 'l', 'bolsa', 'rollo', 'global'];
    for (const unit of units) {
      expect(createMaterialSchema.safeParse({ ...validMaterial, unit }).success).toBe(true);
    }
  });

  it('rechaza estimatedCost negativo', () => {
    const result = createMaterialSchema.safeParse({ ...validMaterial, estimatedCost: -1 });
    expect(result.success).toBe(false);
  });

  it('acepta estimatedCost cero', () => {
    const result = createMaterialSchema.safeParse({ ...validMaterial, estimatedCost: 0 });
    expect(result.success).toBe(true);
  });

  it('rechaza status fuera del enum', () => {
    const result = createMaterialSchema.safeParse({ ...validMaterial, status: 'entregado' });
    expect(result.success).toBe(false);
  });

  it('activityId es opcional', () => {
    expect(createMaterialSchema.safeParse(validMaterial).success).toBe(true);
  });
});

describe('updateMaterialSchema', () => {
  it('acepta un update parcial de sólo status: las transiciones son libres', () => {
    expect(updateMaterialSchema.safeParse({ status: 'en_obra' }).success).toBe(true);
  });
});
