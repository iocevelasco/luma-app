import { describe, expect, it } from 'vitest';
import { es } from 'date-fns/locale';
import { projectCaption } from './project-timing';

const DATES = { estimatedStartDate: '2026-10-10', estimatedEndDate: '2026-10-20' };

/** Mediodía local salvo que se pida otra hora: las horas son justo lo que este módulo no debe mostrar. */
const at = (day: number, hour = 12, minute = 0) => new Date(2026, 9, day, hour, minute);

describe('projectCaption', () => {
  it('obra por empezar: cuenta los días hasta el inicio', () => {
    expect(projectCaption(DATES, at(8), es)).toEqual({
      phase: 'upcoming',
      key: 'startsIn',
      distance: 'en 2 días',
    });
  });

  it('obra en curso: cuenta los días hasta el fin', () => {
    expect(projectCaption(DATES, at(15), es)).toEqual({
      phase: 'active',
      key: 'endsIn',
      distance: 'en 5 días',
    });
  });

  it('mañana es el último día: "en 1 día", nunca en horas', () => {
    expect(projectCaption(DATES, at(19), es).distance).toBe('en 1 día');
    // A las 23:30 faltan 30 minutos para la medianoche, pero el día de calendario sigue siendo 1.
    expect(projectCaption(DATES, at(19, 23, 30), es).distance).toBe('en 1 día');
  });

  it('el último día dice "termina hoy", a cualquier hora, y no lleva distancia', () => {
    for (const [hour, minute] of [
      [0, 0],
      [0, 5],
      [14, 0],
      [23, 59],
    ]) {
      const caption = projectCaption(DATES, at(20, hour, minute), es);
      expect(caption).toEqual({ phase: 'active', key: 'endsToday' });
    }
  });

  it('el primer día ya está en curso', () => {
    expect(projectCaption(DATES, at(10, 0, 1), es)).toMatchObject({ phase: 'active', key: 'endsIn' });
  });

  it('una obra de un solo día dice "termina hoy" ese día', () => {
    const oneDay = { estimatedStartDate: '2026-10-20', estimatedEndDate: '2026-10-20' };
    expect(projectCaption(oneDay, at(20), es)).toEqual({ phase: 'active', key: 'endsToday' });
  });

  it('vencida: hace cuántos días terminó, y el día siguiente al fin ya es "hace 1 día"', () => {
    expect(projectCaption(DATES, at(21, 0, 30), es)).toEqual({
      phase: 'done',
      key: 'endedAgo',
      distance: 'hace 1 día',
    });
    expect(projectCaption(DATES, at(25), es).distance).toBe('hace 5 días');
  });

  it('las distancias largas pasan a meses, no a una cuenta de cientos de días', () => {
    const far = { estimatedStartDate: '2027-03-01', estimatedEndDate: '2027-06-30' };
    expect(projectCaption(far, at(1), es).distance).toBe('en 5 meses');
  });

  it('en una obra vigente nunca aparece una cifra en horas ni minutos', () => {
    for (let day = 10; day <= 20; day++) {
      for (const hour of [0, 6, 13, 23]) {
        expect(projectCaption(DATES, at(day, hour), es).distance ?? '').not.toMatch(/hora|minuto/);
      }
    }
  });
});
