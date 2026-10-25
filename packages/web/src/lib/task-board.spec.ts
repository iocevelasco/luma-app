import { describe, expect, it } from 'vitest';
import { canInProject, type Activity, type ActivityStatus, type ProjectRole } from '@luma/shared';
import {
  allowedMoves,
  durationDays,
  layoutTasks,
  responsibleKey,
  taskPeople,
  tasksForWeek,
  weightedProgress,
} from './task-board';

const WEEK = { from: '2026-10-12', to: '2026-10-18' };
const TODAY = '2026-10-14';

function task(
  id: string,
  startDate: string,
  endDate: string,
  status: ActivityStatus = 'pendiente',
  responsible: Activity['responsible'] = { name: 'Juan Pérez' },
): Activity {
  return {
    id,
    projectId: 'p1',
    name: `tarea ${id}`,
    startDate,
    endDate,
    responsible,
    status,
    evidence: [],
    createdBy: 'u1',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const can = (role: ProjectRole) => (capability: Parameters<typeof canInProject>[1]) =>
  canInProject(role, capability);

describe('tasksForWeek', () => {
  const tasks = [
    task('adentro', '2026-10-13', '2026-10-14'),
    task('empieza-antes', '2026-10-01', '2026-10-13'),
    task('termina-despues', '2026-10-17', '2026-10-30'),
    task('semana-pasada-cerrada', '2026-10-05', '2026-10-09', 'completada'),
    task('atrasada', '2026-10-05', '2026-10-09', 'en_curso'),
    task('cancelada-vieja', '2026-10-05', '2026-10-09', 'cancelada'),
    task('futura', '2026-10-20', '2026-10-22'),
  ];

  it('trae las que caen en la semana, aunque empiecen antes o terminen después', () => {
    const ids = tasksForWeek(tasks, WEEK, { includeOverdue: false }).map((t) => t.id);
    expect(ids).toEqual(['adentro', 'empieza-antes', 'termina-despues']);
  });

  it('en la semana en curso suma las atrasadas abiertas, no las cerradas', () => {
    const ids = tasksForWeek(tasks, WEEK, { includeOverdue: true }).map((t) => t.id);
    expect(ids).toContain('atrasada');
    expect(ids).not.toContain('semana-pasada-cerrada');
    expect(ids).not.toContain('cancelada-vieja');
    expect(ids).not.toContain('futura');
  });

  describe('lo que se cerró esa semana', () => {
    /** Una tarea con `updatedAt` en el día dado (hora del mediodía: sin zonas horarias de por medio). */
    const touchedOn = (id: string, status: ActivityStatus, day: string): Activity => ({
      ...task(id, '2026-10-05', '2026-10-09', status),
      updatedAt: `${day}T15:00:00`,
    });

    it('una atrasada que se completa esta semana sigue a la vista', () => {
      const completed = touchedOn('recien-completada', 'completada', '2026-10-14');
      const ids = tasksForWeek([completed], WEEK, { includeOverdue: true }).map((t) => t.id);
      expect(ids).toEqual(['recien-completada']);
    });

    it('lo mismo con una cancelada', () => {
      const cancelled = touchedOn('recien-cancelada', 'cancelada', '2026-10-13');
      expect(tasksForWeek([cancelled], WEEK, { includeOverdue: true })).toHaveLength(1);
    });

    it('una cerrada que se tocó en otra semana no aparece', () => {
      const old = touchedOn('cerrada-hace-rato', 'completada', '2026-10-02');
      expect(tasksForWeek([old], WEEK, { includeOverdue: true })).toHaveLength(0);
    });

    it('una abierta tocada esta semana no entra por esto: entra por sus fechas', () => {
      const open = { ...touchedOn('abierta-vieja', 'pendiente', '2026-10-14'), endDate: '2026-10-06' };
      // Atrasada: entra sólo en la semana en curso (`includeOverdue`), no por haberla tocado.
      expect(tasksForWeek([open], WEEK, { includeOverdue: false })).toHaveLength(0);
    });
  });
});

describe('layoutTasks', () => {
  it('reparte por estado y deja las canceladas afuera de las columnas', () => {
    const layout = layoutTasks(
      [
        task('a', '2026-10-13', '2026-10-13', 'pendiente'),
        task('b', '2026-10-13', '2026-10-13', 'en_curso'),
        task('c', '2026-10-13', '2026-10-13', 'en_revision'),
        task('d', '2026-10-13', '2026-10-13', 'completada'),
        task('e', '2026-10-13', '2026-10-13', 'cancelada'),
      ],
      null,
      TODAY,
    );
    expect(layout.columns.pendiente.map((t) => t.id)).toEqual(['a']);
    expect(layout.columns.en_curso.map((t) => t.id)).toEqual(['b']);
    expect(layout.columns.en_revision.map((t) => t.id)).toEqual(['c']);
    expect(layout.columns.completada.map((t) => t.id)).toEqual(['d']);
    expect(layout.cancelled.map((t) => t.id)).toEqual(['e']);
  });

  it('las atrasadas arriba, después por fecha de fin', () => {
    const layout = layoutTasks(
      [
        task('mas-tarde', '2026-10-13', '2026-10-17'),
        task('atrasada', '2026-10-05', '2026-10-09'),
        task('antes', '2026-10-13', '2026-10-15'),
      ],
      null,
      TODAY,
    );
    expect(layout.columns.pendiente.map((t) => t.id)).toEqual(['atrasada', 'antes', 'mas-tarde']);
  });

  it('filtra por responsable', () => {
    const ana = { name: 'Ana' };
    const tasks = [task('a', '2026-10-13', '2026-10-13'), task('b', '2026-10-13', '2026-10-13', 'pendiente', ana)];
    const layout = layoutTasks(tasks, responsibleKey(tasks[1]), TODAY);
    expect(layout.columns.pendiente.map((t) => t.id)).toEqual(['b']);
  });
});

describe('responsibleKey y taskPeople', () => {
  it('el mismo nombre escrito distinto es la misma persona', () => {
    const a = task('a', '2026-10-13', '2026-10-13', 'pendiente', { name: 'Juan Pérez' });
    const b = task('b', '2026-10-13', '2026-10-13', 'pendiente', { name: 'juan  perez' });
    expect(responsibleKey(a)).toBe(responsibleKey(b));
    expect(taskPeople([a, b])).toHaveLength(1);
  });

  it('alguien con cuenta se identifica por su usuario, no por el nombre', () => {
    const a = task('a', '2026-10-13', '2026-10-13', 'pendiente', { name: 'Ana', user: 'u1' });
    const b = task('b', '2026-10-13', '2026-10-13', 'pendiente', { name: 'Ana', user: 'u2' });
    expect(taskPeople([a, b])).toHaveLength(2);
  });
});

describe('allowedMoves — la misma regla que la API', () => {
  it('el supervisor mueve por el flujo, pero no cierra ni cancela', () => {
    expect(allowedMoves('pendiente', can('supervisor'))).toEqual(['en_curso', 'en_revision']);
    expect(allowedMoves('en_revision', can('supervisor'))).toEqual(['pendiente', 'en_curso']);
  });

  it('el supervisor no reabre una completada ni restaura una cancelada', () => {
    expect(allowedMoves('completada', can('supervisor'))).toEqual([]);
    expect(allowedMoves('cancelada', can('supervisor'))).toEqual([]);
  });

  it('el gerente cierra, reabre, cancela y restaura', () => {
    expect(allowedMoves('en_revision', can('gerente'))).toEqual([
      'pendiente',
      'en_curso',
      'completada',
      'cancelada',
    ]);
    expect(allowedMoves('completada', can('gerente'))).toContain('en_curso');
    expect(allowedMoves('cancelada', can('gerente'))).toEqual(['pendiente']);
  });

  it('el cliente no mueve nada', () => {
    expect(allowedMoves('pendiente', can('cliente'))).toEqual([]);
  });
});

describe('durationDays', () => {
  it('cuenta el primero y el último', () => {
    expect(durationDays({ startDate: '2026-10-13', endDate: '2026-10-13' })).toBe(1);
    expect(durationDays({ startDate: '2026-10-13', endDate: '2026-10-17' })).toBe(5);
  });

  it('cruza meses, y el cambio de horario no le resta un día', () => {
    expect(durationDays({ startDate: '2026-09-28', endDate: '2026-10-04' })).toBe(7);
  });
});

describe('weightedProgress — por duración, no por cantidad', () => {
  it('una tarea larga pesa más que muchas cortas', () => {
    const tasks = [
      task('estructura', '2026-09-01', '2026-10-30', 'completada'),
      ...Array.from({ length: 10 }, (_, i) => task(`corta-${i}`, '2026-10-13', '2026-10-13')),
    ];
    const progress = weightedProgress(tasks);
    // 60 días hechos de 70: 86%. Contando de a una daría 1 de 11, el 9%.
    expect(progress.percent).toBe(86);
    expect(progress).toMatchObject({ completed: 1, total: 11 });
  });

  it('las canceladas no cuentan', () => {
    const progress = weightedProgress([
      task('hecha', '2026-10-13', '2026-10-14', 'completada'),
      task('cancelada', '2026-10-13', '2026-10-30', 'cancelada'),
    ]);
    expect(progress.percent).toBe(100);
    expect(progress.total).toBe(1);
  });

  it('sin tareas, cero', () => {
    expect(weightedProgress([])).toEqual({ percent: 0, completed: 0, total: 0 });
  });
});
