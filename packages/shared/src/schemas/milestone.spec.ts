import { describe, expect, it } from 'vitest';
import { MILESTONE_DESCRIPTION_MAX } from '../types/milestone.js';
import { createMilestoneSchema, updateMilestoneSchema } from './milestone.js';

const BASE = {
  type: 'reunion',
  audience: 'cliente',
  title: 'Visita con el cliente',
  occurredOn: '2026-10-15',
};

describe('createMilestoneSchema', () => {
  it('acepta una reunión con asistentes', () => {
    const parsed = createMilestoneSchema.safeParse({
      ...BASE,
      attendees: ['  Ana Pérez ', 'Arq. Gómez'],
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.attendees).toEqual(['Ana Pérez', 'Arq. Gómez']);
  });

  it('rechaza asistentes en un hito que no es reunión', () => {
    const parsed = createMilestoneSchema.safeParse({
      ...BASE,
      type: 'vicio_oculto',
      attendees: ['Ana Pérez'],
    });
    expect(parsed.success).toBe(false);
    expect(!parsed.success && parsed.error.issues[0].path).toEqual(['attendees']);
  });

  it('acepta una lista de asistentes vacía en cualquier tipo', () => {
    const parsed = createMilestoneSchema.safeParse({ ...BASE, type: 'retraso', attendees: [] });
    expect(parsed.success).toBe(true);
  });

  it('rechaza un asistente con nombre vacío', () => {
    expect(createMilestoneSchema.safeParse({ ...BASE, attendees: ['  '] }).success).toBe(false);
  });

  it('admite una minuta de hasta el límite y rechaza una más larga', () => {
    const atLimit = 'a'.repeat(MILESTONE_DESCRIPTION_MAX);
    expect(createMilestoneSchema.safeParse({ ...BASE, description: atLimit }).success).toBe(true);
    expect(createMilestoneSchema.safeParse({ ...BASE, description: `${atLimit}a` }).success).toBe(
      false,
    );
  });
});

describe('updateMilestoneSchema', () => {
  it('rechaza pasar a otro tipo y mandar asistentes a la vez', () => {
    const parsed = updateMilestoneSchema.safeParse({ type: 'otro', attendees: ['Ana'] });
    expect(parsed.success).toBe(false);
  });

  it('deja pasar asistentes sin tipo: lo decide el controller con el hito guardado', () => {
    expect(updateMilestoneSchema.safeParse({ attendees: ['Ana'] }).success).toBe(true);
  });
});
