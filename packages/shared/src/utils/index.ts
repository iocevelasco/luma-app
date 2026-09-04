// ============================================================================
// Utilidades puras compartidas. Nada acá toca red, DOM ni base de datos: se
// usan igual en el navegador, en el servidor y en un test.
// ============================================================================

/**
 * URL base de la API.
 *
 * En desarrollo el proxy de Vite manda `/api` al backend, así que la base
 * vacía (ruta relativa) es lo correcto. En producción el mismo Express sirve
 * el SPA, así que también es relativa. La variable de entorno existe para el
 * caso en que el front se sirva desde otro origen.
 */
export function getApiBaseUrl(envUrl?: string): string {
  if (envUrl) return envUrl.replace(/\/$/, '');
  return '';
}

// ─── Semanas ISO ─────────────────────────────────────────────────────────────

/**
 * Clave de semana ISO: `2026-W36`.
 *
 * La semana es la unidad de planificación principal (RF-01), así que conviene
 * que sea una string ordenable y comparable con `===`, no un rango de fechas
 * que haya que recalcular en cada consulta.
 */
export function isoWeekKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Jueves de esa semana: define el año ISO.
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Lunes (00:00) y domingo (23:59:59) de la semana ISO indicada. */
export function weekRange(weekKey: string): { start: Date; end: Date } {
  const [yearStr, weekStr] = weekKey.split('-W');
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

export function shiftWeek(weekKey: string, delta: number): string {
  const { start } = weekRange(weekKey);
  start.setUTCDate(start.getUTCDate() + delta * 7);
  return isoWeekKey(start);
}

export function currentWeekKey(): string {
  return isoWeekKey(new Date());
}

/** YYYY-MM-DD en hora local, que es como la obra piensa el día. */
export function toDateKey(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysBetween(a: Date | string, b: Date | string): number {
  const d1 = typeof a === 'string' ? new Date(a) : a;
  const d2 = typeof b === 'string' ? new Date(b) : b;
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

// ─── Dinero y porcentajes ────────────────────────────────────────────────────

export function formatCurrency(value: number, currency = 'ARS', locale = 'es-AR'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString(locale)}`;
  }
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return round2((part / whole) * 100);
}

// ─── Semáforo presupuestal (RF-05) ───────────────────────────────────────────

export function budgetHealthFor(
  deviationPct: number,
  thresholds: { warning_pct: number; danger_pct: number },
): 'healthy' | 'warning' | 'danger' {
  if (deviationPct >= thresholds.danger_pct) return 'danger';
  if (deviationPct >= thresholds.warning_pct) return 'warning';
  return 'healthy';
}

// ─── Texto ───────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** IMP-001, IMP-002… correlativo legible por proyecto. */
export function contingencyCode(sequence: number): string {
  return `IMP-${String(sequence).padStart(3, '0')}`;
}
