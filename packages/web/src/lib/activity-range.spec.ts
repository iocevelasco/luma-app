import { describe, expect, it } from 'vitest';
import { scheduleRange } from './activity-range';

const project = { estimatedStartDate: '2026-08-07', estimatedEndDate: '2027-01-30' };

describe('scheduleRange', () => {
  it('sin tareas es el rango de la obra', () => {
    expect(scheduleRange(project, [])).toEqual({ from: '2026-08-07', to: '2027-01-30' });
  });

  it('con tareas dentro de la obra no cambia', () => {
    const range = scheduleRange(project, [{ startDate: '2026-10-13', endDate: '2026-10-16' }]);
    expect(range).toEqual({ from: '2026-08-07', to: '2027-01-30' });
  });

  it('una tarea que termina después de la entrega estira el final', () => {
    const range = scheduleRange(project, [{ startDate: '2027-01-20', endDate: '2027-03-15' }]);
    expect(range).toEqual({ from: '2026-08-07', to: '2027-03-15' });
  });

  it('una tarea que empieza antes del inicio estira el comienzo', () => {
    const range = scheduleRange(project, [{ startDate: '2026-07-01', endDate: '2026-07-10' }]);
    expect(range).toEqual({ from: '2026-07-01', to: '2027-01-30' });
  });

  it('toma los extremos entre varias tareas', () => {
    const range = scheduleRange(project, [
      { startDate: '2026-06-01', endDate: '2026-06-02' },
      { startDate: '2027-02-01', endDate: '2027-02-28' },
      { startDate: '2026-09-01', endDate: '2026-09-05' },
    ]);
    expect(range).toEqual({ from: '2026-06-01', to: '2027-02-28' });
  });
});
