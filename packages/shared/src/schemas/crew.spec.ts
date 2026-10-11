import { describe, expect, it } from 'vitest';
import {
  createCrewGoalSchema,
  createCrewMemberSchema,
  crewSpecialtySchema,
  updateCrewGoalSchema,
} from './crew.js';
import { providerSpecialtySchema } from './provider.js';

describe('crewSpecialtySchema', () => {
  /**
   * El catálogo está duplicado a propósito (los schemas de dominio no se
   * importan entre sí), así que hace falta un test que avise si alguien
   * agrega un rubro de un lado y se olvida del otro.
   */
  it('tiene exactamente los mismos rubros que el de proveedores', () => {
    expect([...crewSpecialtySchema.options].sort()).toEqual(
      [...providerSpecialtySchema.options].sort(),
    );
  });
});

describe('createCrewMemberSchema', () => {
  const valid = { name: 'Juan Pérez' };

  it('acepta lo mínimo y asume persona de la libreta', () => {
    const result = createCrewMemberSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('persona');
      expect(result.data.scope).toBe('organization');
      expect(result.data.isLead).toBe(false);
    }
  });

  it('acepta un equipo entero como destinatario de metas', () => {
    expect(createCrewMemberSchema.safeParse({ ...valid, kind: 'equipo' }).success).toBe(true);
  });

  it('acepta un encargado de especialidad', () => {
    const result = createCrewMemberSchema.safeParse({
      ...valid,
      specialty: 'electricidad',
      isLead: true,
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un nombre vacío', () => {
    expect(createCrewMemberSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rechaza una especialidad que no existe', () => {
    expect(createCrewMemberSchema.safeParse({ ...valid, specialty: 'soldadura' }).success).toBe(
      false,
    );
  });
});

describe('createCrewGoalSchema', () => {
  const valid = {
    crewMemberId: 'crew-1',
    weekStart: '2026-09-28',
    description: 'Terminar el revoque del segundo piso',
  };

  it('acepta una meta válida y nace pendiente', () => {
    const result = createCrewGoalSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('pendiente');
  });

  it('rechaza una meta sin descripción', () => {
    expect(createCrewGoalSchema.safeParse({ ...valid, description: '  ' }).success).toBe(false);
  });

  it('rechaza una semana con formato inválido', () => {
    expect(createCrewGoalSchema.safeParse({ ...valid, weekStart: '28/09/2026' }).success).toBe(
      false,
    );
  });

  it('rechaza una meta sin destinatario', () => {
    expect(createCrewGoalSchema.safeParse({ ...valid, crewMemberId: '' }).success).toBe(false);
  });
});

describe('updateCrewGoalSchema', () => {
  it('permite marcarla cumplida', () => {
    expect(updateCrewGoalSchema.safeParse({ status: 'cumplida' }).success).toBe(true);
  });

  it('distingue "no cumplida" de "pendiente"', () => {
    expect(updateCrewGoalSchema.safeParse({ status: 'no_cumplida' }).success).toBe(true);
    expect(updateCrewGoalSchema.safeParse({ status: 'fallida' }).success).toBe(false);
  });
});
