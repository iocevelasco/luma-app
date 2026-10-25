import { describe, it, expect } from 'vitest';
import { fromDayKey, toDayKey } from './day-key';

/**
 * El rango se manda al backend como `YYYY-MM-DD`, no como `Date`.
 *
 * La trampa que cubren estos tests: `toISOString()` convierte a UTC, así que
 * para alguien en Argentina (UTC-3) el 13 a las 00:30 se serializa como el 12.
 * Elegir "hoy" en el calendario terminaba pidiendo el día anterior, y la caja
 * del día aparecía vacía hasta las 03:00.
 */

describe('toDayKey', () => {
  it('usa el día LOCAL, no el UTC', () => {
    // 00:30 local. En UTC-3 esto es 03:30Z del mismo día, pero lo que importa
    // es que el resultado siga el reloj de pared de quien lo mira.
    const madrugada = new Date(2026, 7, 13, 0, 30);
    expect(toDayKey(madrugada)).toBe('2026-08-13');
  });

  it('no se corre de día a última hora', () => {
    const nocheTarde = new Date(2026, 7, 13, 23, 59);
    expect(toDayKey(nocheTarde)).toBe('2026-08-13');
  });

  it('rellena mes y día con cero a la izquierda', () => {
    // Sin padding sale "2026-1-5", que el backend rechaza con 400.
    expect(toDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('fromDayKey', () => {
  it('es la medianoche LOCAL de ese día, no la UTC', () => {
    const date = fromDayKey('2026-08-13');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 7, 13]);
    expect([date.getHours(), date.getMinutes()]).toEqual([0, 0]);
  });

  it('va y viene con toDayKey, también en los bordes de mes y de año', () => {
    for (const key of ['2026-01-01', '2026-12-31', '2028-02-29', '2026-03-08']) {
      expect(toDayKey(fromDayKey(key))).toBe(key);
    }
  });
});
