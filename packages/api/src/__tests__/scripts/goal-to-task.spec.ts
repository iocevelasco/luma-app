import { describe, expect, it } from 'vitest';
import { goalToTask, weekEndOf, type LegacyGoal } from '../../scripts/lib/goal-to-task.js';

const goal: LegacyGoal = {
  project: 'project-1',
  description: 'Terminar el revoque',
  weekStart: '2026-09-28',
  status: 'pending',
  updatedAt: new Date('2026-10-01T12:00:00Z'),
  createdBy: 'user-1',
};

describe('weekEndOf', () => {
  it('es el domingo de esa semana', () => {
    expect(weekEndOf('2026-10-12')).toBe('2026-10-18');
  });

  it('cruza de mes y de año', () => {
    expect(weekEndOf('2026-09-28')).toBe('2026-10-04');
    expect(weekEndOf('2026-12-28')).toBe('2027-01-03');
  });
});

describe('goalToTask', () => {
  it('dura la semana de la meta y su dueño es el responsable', () => {
    const task = goalToTask(goal, { name: 'Juan Pérez', specialty: 'albanileria' }, null);
    expect(task).toMatchObject({
      name: 'Terminar el revoque',
      startDate: '2026-09-28',
      endDate: '2026-10-04',
      responsible: { name: 'Juan Pérez' },
      status: 'pendiente',
      specialty: 'albanileria',
      review: null,
    });
  });

  it('traduce los estados de las dos épocas', () => {
    const statusOf = (status: string) => goalToTask({ ...goal, status }, null, null).status;
    expect(statusOf('pendiente')).toBe('pendiente');
    expect(statusOf('pending')).toBe('pendiente');
    expect(statusOf('in_progress')).toBe('en_curso');
    expect(statusOf('cumplida')).toBe('completada');
    expect(statusOf('done')).toBe('completada');
    expect(statusOf('no_cumplida')).toBe('cancelada');
    expect(statusOf('discarded')).toBe('cancelada');
  });

  it('una cumplida nace cerrada con su revisión aprobada', () => {
    const completedAt = new Date('2026-10-02T09:00:00Z');
    const task = goalToTask({ ...goal, status: 'done', completedAt }, null, null);
    expect(task.review).toEqual({
      reportedBy: 'user-1',
      reportedAt: completedAt,
      approvedBy: 'user-1',
      approvedAt: completedAt,
    });
  });

  it('sin fecha de cierre usa la última edición', () => {
    const task = goalToTask({ ...goal, status: 'cumplida' }, null, null);
    expect(task.review?.approvedAt).toEqual(goal.updatedAt);
  });

  it('la especialidad sale de la actividad vinculada, si no de la persona, si no "otra"', () => {
    const owner = { name: 'Juan', specialty: 'pintura' as const };
    const linked = { name: 'Fachada', specialty: 'albanileria' as const };
    expect(goalToTask(goal, owner, linked).specialty).toBe('albanileria');
    expect(goalToTask(goal, owner, null).specialty).toBe('pintura');
    expect(goalToTask(goal, null, null).specialty).toBe('otra');
  });

  it('deja anotada la actividad a la que apuntaba', () => {
    expect(goalToTask(goal, null, { name: 'Fachada' }).notes).toBe('Parte de «Fachada».');
    expect(goalToTask(goal, null, null).notes).toBeUndefined();
  });

  it('sin persona no queda sin responsable: la tarea lo exige', () => {
    expect(goalToTask(goal, null, null).responsible.name).toBe('Sin responsable');
  });

  it('recorta un texto largo al máximo de nombre de tarea', () => {
    expect(goalToTask({ ...goal, description: 'x'.repeat(300) }, null, null).name).toHaveLength(
      120,
    );
  });
});
