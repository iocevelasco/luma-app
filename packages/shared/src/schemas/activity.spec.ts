import { describe, expect, it } from 'vitest';
import { createActivitySchema, updateActivitySchema } from './activity.js';

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
