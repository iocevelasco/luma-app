import { describe, expect, it } from 'vitest';
import {
  createProjectSchema,
  inviteClientSchema,
  inviteMemberSchema,
  renameOrganizationSchema,
  updateOrganizationMemberSchema,
} from './project.js';

const validProject = {
  name: 'Baño 2do piso',
  description: 'Remodelación completa del baño principal',
  location: 'CABA',
  estimatedStartDate: '2026-09-01',
  estimatedEndDate: '2026-10-15',
  currency: 'ARS',
};

describe('createProjectSchema', () => {
  it('acepta una obra válida', () => {
    expect(createProjectSchema.safeParse(validProject).success).toBe(true);
  });

  it('ignora un budgetType viejo en vez de rechazar la obra', () => {
    const result = createProjectSchema.safeParse({ ...validProject, budgetType: 'cerrado' });
    expect(result.success).toBe(true);
    expect(result.success && 'budgetType' in result.data).toBe(false);
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

describe('inviteMemberSchema', () => {
  const valid = { email: 'Ana@Estudio.com', name: '  Ana Pérez ', staffRole: 'contador' as const };

  it('acepta email, nombre y función, y los normaliza', () => {
    const result = inviteMemberSchema.parse(valid);
    expect(result).toEqual({ email: 'ana@estudio.com', name: 'Ana Pérez', staffRole: 'contador' });
  });

  it('exige el nombre', () => {
    expect(inviteMemberSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('exige la función: no hay default que la adivine', () => {
    const { staffRole: _omitted, ...withoutRole } = valid;
    expect(inviteMemberSchema.safeParse(withoutRole).success).toBe(false);
  });

  it('rechaza cliente: quien paga no es parte de la Empresa', () => {
    expect(inviteMemberSchema.safeParse({ ...valid, staffRole: 'cliente' }).success).toBe(false);
  });
});

describe('updateOrganizationMemberSchema', () => {
  it('la función es opcional: corregir un nombre no obliga a inventarla', () => {
    expect(updateOrganizationMemberSchema.safeParse({ name: 'Ana' }).success).toBe(true);
  });

  it('rechaza una función fuera del enum', () => {
    expect(
      updateOrganizationMemberSchema.safeParse({ name: 'Ana', staffRole: 'obrero' }).success,
    ).toBe(false);
  });
});
