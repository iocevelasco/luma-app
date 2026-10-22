import { describe, expect, it } from 'vitest';
import {
  activitySpecialtySchema,
  createActivitySchema,
  rejectActivitySchema,
  updateActivitySchema,
} from './activity.js';
import { providerSpecialtySchema } from './provider.js';

const validActivity = {
  name: 'Contrapiso',
  specialty: 'albanileria' as const,
  startDate: '2026-09-14',
  endDate: '2026-09-18',
  responsible: { name: 'Juan Pérez' },
};

describe('createActivitySchema', () => {
  it('acepta una actividad válida', () => {
    expect(createActivitySchema.safeParse(validActivity).success).toBe(true);
  });

  it('nace con su cuadrilla: es lo que la lleva a la asistencia de la Jornada', () => {
    const result = createActivitySchema.safeParse({ ...validActivity, crewMemberIds: ['crew-1'] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.crewMemberIds).toEqual(['crew-1']);
  });

  it('la cuadrilla es opcional', () => {
    const result = createActivitySchema.safeParse(validActivity);
    expect(result.success && result.data.crewMemberIds).toBeUndefined();
  });

  it('no acepta ids vacíos en la cuadrilla', () => {
    expect(createActivitySchema.safeParse({ ...validActivity, crewMemberIds: [''] }).success).toBe(
      false,
    );
  });

  it('default de status es pendiente', () => {
    const result = createActivitySchema.safeParse(validActivity);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('pendiente');
  });

  it('rechaza endDate anterior a startDate', () => {
    const result = createActivitySchema.safeParse({
      ...validActivity,
      startDate: '2026-09-18',
      endDate: '2026-09-14',
    });
    expect(result.success).toBe(false);
  });

  it('acepta endDate igual a startDate', () => {
    const result = createActivitySchema.safeParse({
      ...validActivity,
      startDate: '2026-09-14',
      endDate: '2026-09-14',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza fechas que no son YYYY-MM-DD', () => {
    const result = createActivitySchema.safeParse({ ...validActivity, startDate: '14/09/2026' });
    expect(result.success).toBe(false);
  });

  it('rechaza status fuera del enum', () => {
    const result = createActivitySchema.safeParse({ ...validActivity, status: 'en_pausa' });
    expect(result.success).toBe(false);
  });

  it('rechaza responsible sin name', () => {
    const result = createActivitySchema.safeParse({ ...validActivity, responsible: {} });
    expect(result.success).toBe(false);
  });
});

describe('activitySpecialtySchema', () => {
  it('tiene los mismos oficios que el de proveedores, que suma sólo `materiales`', () => {
    // `materiales` es quien vende, no un oficio: no existe fuera de proveedores.
    expect([...activitySpecialtySchema.options].sort()).toEqual(
      providerSpecialtySchema.options.filter((specialty) => specialty !== 'materiales').sort(),
    );
  });

  it('la especialidad es obligatoria al crear: reemplaza al área', () => {
    const { specialty: _omit, ...withoutSpecialty } = validActivity;
    expect(createActivitySchema.safeParse(withoutSpecialty).success).toBe(false);
  });

  it('al editar no hace falta: las actividades viejas no tienen especialidad', () => {
    expect(updateActivitySchema.safeParse({ name: 'Contrapiso nuevo' }).success).toBe(true);
  });

  it('ignora un área vieja en vez de rechazar el pedido', () => {
    const result = createActivitySchema.safeParse({ ...validActivity, area: 'Planta baja' });
    expect(result.success).toBe(true);
    expect(result.success && 'area' in result.data).toBe(false);
  });

  it('acepta una actividad con rubro declarado', () => {
    expect(
      createActivitySchema.safeParse({ ...validActivity, specialty: 'electricidad' }).success,
    ).toBe(true);
  });
});

describe('estado en_revision', () => {
  it('acepta el paso intermedio antes de cerrar', () => {
    expect(
      createActivitySchema.safeParse({ ...validActivity, status: 'en_revision' }).success,
    ).toBe(true);
  });
});

describe('rejectActivitySchema', () => {
  it('exige un motivo: un rechazo mudo deja la actividad en limbo', () => {
    expect(rejectActivitySchema.safeParse({ reason: '   ' }).success).toBe(false);
    expect(rejectActivitySchema.safeParse({}).success).toBe(false);
  });

  it('acepta un motivo escrito', () => {
    expect(rejectActivitySchema.safeParse({ reason: 'Falta terminar el borde' }).success).toBe(
      true,
    );
  });
});

describe('updateActivitySchema', () => {
  it('acepta un update parcial', () => {
    expect(updateActivitySchema.safeParse({ status: 'en_curso' }).success).toBe(true);
  });

  it('rechaza fechas invertidas cuando vienen las dos', () => {
    const result = updateActivitySchema.safeParse({
      startDate: '2026-09-18',
      endDate: '2026-09-14',
    });
    expect(result.success).toBe(false);
  });
});
