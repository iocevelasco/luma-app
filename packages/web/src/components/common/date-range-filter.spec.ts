import { describe, it, expect } from 'vitest';
import { toDayKey, presetRange } from './date-range-filter';

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

describe('presetRange', () => {
  const hoy = new Date(2026, 7, 16); // 16 de agosto de 2026

  it('«este mes» va del 1 al último día del mes', () => {
    expect(presetRange('thisMonth', hoy)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('«mes pasado» no se pisa con el actual', () => {
    expect(presetRange('lastMonth', hoy)).toEqual({ from: '2026-07-01', to: '2026-07-31' });
  });

  it('«últimos 30 días» incluye hoy y suma 30 días, no 31', () => {
    const r = presetRange('last30', hoy);
    expect(r).toEqual({ from: '2026-07-18', to: '2026-08-16' });

    const dias =
      (new Date(2026, 7, 16).getTime() - new Date(2026, 6, 18).getTime()) / 86_400_000 + 1;
    expect(dias).toBe(30);
  });

  it('«este año» cubre enero a diciembre', () => {
    expect(presetRange('thisYear', hoy)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('resuelve el último día de febrero según el año', () => {
    expect(presetRange('thisMonth', new Date(2026, 1, 10)).to).toBe('2026-02-28');
    expect(presetRange('thisMonth', new Date(2028, 1, 10)).to).toBe('2028-02-29'); // bisiesto
  });

  it('«mes pasado» cruza el año hacia atrás', () => {
    expect(presetRange('lastMonth', new Date(2026, 0, 15))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('«últimos 30 días» cruza el mes hacia atrás', () => {
    expect(presetRange('last30', new Date(2026, 0, 5))).toEqual({
      from: '2025-12-07',
      to: '2026-01-05',
    });
  });
});
