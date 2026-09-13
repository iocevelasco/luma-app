import { describe, expect, it } from 'vitest';
import { createProjectSchema, inviteClientSchema, renameOrganizationSchema } from './project.js';

const validProject = {
  name: 'Baño 2do piso',
  description: 'Remodelación completa del baño principal',
  location: 'CABA',
  estimatedStartDate: '2026-09-01',
  estimatedEndDate: '2026-10-15',
  currency: 'ARS',
  budgetType: 'cerrado' as const,
};

describe('createProjectSchema', () => {
  it('acepta una obra válida', () => {
    expect(createProjectSchema.safeParse(validProject).success).toBe(true);
  });

  it('rechaza budgetType fuera del enum: no hay default que lo tape', () => {
    const result = createProjectSchema.safeParse({ ...validProject, budgetType: 'gratis' });
    expect(result.success).toBe(false);
  });

  it('rechaza una fecha de entrega anterior al inicio', () => {
    const result = createProjectSchema.safeParse({
      ...validProject,
      estimatedStartDate: '2026-10-15',
      estimatedEndDate: '2026-09-01',
    });
    expect(result.success).toBe(false);
  });

  it('rechaza fechas que no son YYYY-MM-DD', () => {
    const result = createProjectSchema.safeParse({
      ...validProject,
      estimatedStartDate: '01/09/2026',
    });
    expect(result.success).toBe(false);
  });

  it('size es opcional', () => {
    const result = createProjectSchema.safeParse(validProject);
    expect(result.success).toBe(true);
  });
});

describe('inviteClientSchema', () => {
  it('normaliza el email a minúsculas', () => {
    const result = inviteClientSchema.safeParse({ email: 'Cliente@Ejemplo.com' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('cliente@ejemplo.com');
  });

  it('rechaza un email inválido', () => {
    expect(inviteClientSchema.safeParse({ email: 'no-es-un-email' }).success).toBe(false);
  });
});

describe('renameOrganizationSchema', () => {
  it('rechaza un nombre vacío', () => {
    expect(renameOrganizationSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  it('acepta un nombre válido', () => {
    expect(renameOrganizationSchema.safeParse({ name: 'Obras Pérez' }).success).toBe(true);
  });
});
