import { describe, expect, it } from 'vitest';
import { currentWeekRange, isActivityOverdue, isSameWeek, mondayOf, shiftWeek } from './week';

describe('isActivityOverdue', () => {
  const today = '2026-09-13';

  it('vencida y pendiente = true', () => {
    expect(isActivityOverdue('2026-09-10', 'pendiente', today)).toBe(true);
  });

  it('vencida y en_curso = true', () => {
    expect(isActivityOverdue('2026-09-10', 'en_curso', today)).toBe(true);
  });

  it('vencida y completada = false', () => {
    expect(isActivityOverdue('2026-09-10', 'completada', today)).toBe(false);
  });

  it('vencida y cancelada = false', () => {
    expect(isActivityOverdue('2026-09-10', 'cancelada', today)).toBe(false);
  });

  it('no vencida = false', () => {
    expect(isActivityOverdue('2026-09-20', 'pendiente', today)).toBe(false);
  });

  it('vence hoy = no atrasada todavía', () => {
    expect(isActivityOverdue(today, 'pendiente', today)).toBe(false);
  });
});

describe('mondayOf / shiftWeek', () => {
  it('el lunes de un domingo es el lunes anterior', () => {
    const sunday = new Date(2026, 8, 13); // domingo 13 sep 2026
    const monday = mondayOf(sunday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(7);
  });

  it('shiftWeek +1 avanza 7 días', () => {
    const range = currentWeekRange();
    const next = shiftWeek(range, 1);
    expect(isSameWeek(range, next)).toBe(false);
  });

  it('shiftWeek 0 vuelve a la misma semana', () => {
    const range = currentWeekRange();
    expect(isSameWeek(range, shiftWeek(range, 0))).toBe(true);
  });
});
