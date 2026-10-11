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
  area: 'Planta baja',
  startDate: '2026-09-14',
  endDate: '2026-09-18',
  responsible: { name: 'Juan Pérez' },
};

describe('createActivitySchema', () => {
  it('acepta una actividad válida', () => {
    expect(createActivitySchema.safeParse(validActivity).success).toBe(true);
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
  it('tiene exactamente los mismos rubros que el de proveedores', () => {
    expect([...activitySpecialtySchema.options].sort()).toEqual(
      [...providerSpecialtySchema.options].sort(),
    );
  });

  it('la especialidad es opcional: hay actividades de varios rubros', () => {
    expect(createActivitySchema.safeParse(validActivity).success).toBe(true);
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
