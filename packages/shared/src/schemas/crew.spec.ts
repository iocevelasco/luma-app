import { describe, expect, it } from 'vitest';
import { createCrewMemberSchema, crewSpecialtySchema } from './crew.js';
import { providerSpecialtySchema } from './provider.js';

describe('crewSpecialtySchema', () => {
  /**
   * El catálogo está duplicado a propósito (los schemas de dominio no se
   * importan entre sí), así que hace falta un test que avise si alguien
   * agrega un rubro de un lado y se olvida del otro.
   */
  it('tiene los mismos oficios que el de proveedores, que suma sólo `materiales`', () => {
    // `materiales` es quien vende, no un oficio: no existe fuera de proveedores.
    expect([...crewSpecialtySchema.options].sort()).toEqual(
      providerSpecialtySchema.options.filter((specialty) => specialty !== 'materiales').sort(),
    );
  });
});

describe('createCrewMemberSchema', () => {
  const valid = { name: 'Juan Pérez' };

  it('acepta lo mínimo y asume persona', () => {
    const result = createCrewMemberSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kind).toBe('persona');
      expect(result.data.isLead).toBe(false);
    }
  });

  it('ya no acepta elegir el alcance: todo alta va a la libreta de la Empresa', () => {
    const result = createCrewMemberSchema.safeParse({ ...valid, scope: 'project' });
    // Un cliente viejo que todavía lo manda no se rompe: el campo se descarta.
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).not.toHaveProperty('scope');
  });

  it('permite insistir con un homónimo', () => {
    const result = createCrewMemberSchema.safeParse({ ...valid, allowDuplicateName: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.allowDuplicateName).toBe(true);
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
