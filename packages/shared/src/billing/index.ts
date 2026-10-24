/**
 * Las reglas de la suscripción, en un solo lugar.
 *
 * Mismo criterio que `permissions/`: la API y la UI preguntan acá y no
 * repiten la lógica. Y el de `finance.service.ts`: **nada derivado se
 * guarda**. Se guardan los hechos —cuándo empezó la prueba, qué períodos se
 * pagaron, cuándo se creó y archivó cada obra— y el estado, el acceso y el
 * monto de cada cobro se recalculan siempre.
 *
 * Todo trabaja con `Date` en UTC y es puro: sin `new Date()` adentro. El
 * "ahora" lo pasa quien llama, así los tests no dependen del reloj.
 *
 * Las reglas de negocio (acordadas con el dueño del producto):
 *
 * 1. Mes gratis desde el registro, o —si entró invitado— desde que crea su
 *    primera obra propia. Tope de 3 obras activas durante la prueba.
 * 2. Plan: $39/mes con 3 obras activas incluidas. Cada obra activa a partir
 *    de la cuarta suma $8/mes.
 * 3. Pagar durante la prueba NO hace perder días: el período pago arranca
 *    cuando termina la prueba.
 * 4. Salvo que pague para crear la cuarta obra durante la prueba: ahí la
 *    prueba termina ese día y arrancan juntos el plan y la extra, mes
 *    completo, sin prorrateo.
 * 5. Una extra creada a mitad de un período pago se prorratea por los días
 *    que le quedaban al período, y se cobra en la renovación siguiente.
 * 6. Archivar una obra no devuelve días: deja de cobrarse desde la próxima
 *    renovación. Y el lugar que deja ya está pago: si en el mismo período
 *    se crea otra, no se prorratea (sólo se prorratea lo que supera las
 *    extras pagadas por adelantado).
 * 7. Vencida = sólo lectura. Nunca se borra nada.
 * 8. Eliminar una obra es archivarla a efectos del cobro: deja de contar
 *    desde ese momento, pero lo ya usado se cobra (regla 6). Restaurarla es
 *    crearla de nuevo: cuenta desde que se restaura y, si supera lo pago, se
 *    prorratea como cualquier obra nueva (ver `billableWindows`).
 */

import type {
  ChargeLine,
  ChargeQuote,
  StripeSubscriptionStatus,
  SubscriptionPaymentStatus,
  SubscriptionStatus,
} from '../types/subscription.js';

export const PLAN = {
  basePriceUsd: 39,
  extraProjectPriceUsd: 8,
  includedProjects: 3,
  trialDays: 30,
  /** Cuánto sigue con acceso un pago en Bs pendiente o un cobro de Stripe fallido. */
  graceHours: 72,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Suma meses de calendario. Si el día no existe en el mes de destino, cae en
 * el último: 31 de enero + 1 mes = 28 (o 29) de febrero. Sin esto el 31 de
 * enero + 1 daba 3 de marzo y el período "mensual" duraba 31 días un mes y
 * 28 el siguiente según cuándo se pagó.
 */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(
      y,
      m,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * HOUR_MS);
}

function maxDate(dates: (Date | null | undefined)[]): Date | null {
  let best: Date | null = null;
  for (const d of dates) if (d && (!best || d > best)) best = d;
  return best;
}

/** Las fechas de una prueba que arranca `now`. */
export function startTrial(now: Date): { trialStartedAt: Date; trialEndsAt: Date } {
  return { trialStartedAt: now, trialEndsAt: new Date(now.getTime() + PLAN.trialDays * DAY_MS) };
}

// ─────────────────────────────── Hechos ───────────────────────────────

/** Un período cubierto por un pago (en Bs o registrado desde Stripe). */
export interface PaidPeriodFact {
  start: Date;
  end: Date;
  status: SubscriptionPaymentStatus;
  /** Cuándo lo mandó el usuario. Desde acá corre la gracia de un pendiente. */
  submittedAt: Date;
  /** Cuántas obras extra se pagaron por adelantado en este período. */
  prepaidExtras?: number;
}

export interface StripeFact {
  status: StripeSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface SubscriptionFacts {
  /** `null` mientras no empezó: un invitado que todavía no creó obras. */
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
  /** Regla 4: pagó para crear la cuarta obra durante la prueba. */
  trialEndedEarlyAt?: Date | null;
  periods: PaidPeriodFact[];
  stripe?: StripeFact | null;
}

/** Fin efectivo de la prueba: el original, o antes si se cortó por la regla 4. */
export function effectiveTrialEnd(facts: SubscriptionFacts): Date | null {
  if (!facts.trialEndsAt) return null;
  const early = facts.trialEndedEarlyAt;
  return early && early < facts.trialEndsAt ? early : facts.trialEndsAt;
}

/** Hasta cuándo está pago, sin contar la prueba ni la gracia. */
export function paidUntil(facts: SubscriptionFacts): Date | null {
  const approved = facts.periods.filter((p) => p.status === 'aprobado').map((p) => p.end);
  const stripe =
    facts.stripe && (facts.stripe.status === 'active' || facts.stripe.status === 'trialing')
      ? facts.stripe.currentPeriodEnd
      : null;
  return maxDate([...approved, stripe]);
}

/**
 * Desde cuándo arranca el próximo período pago: lo que sea más tarde entre
 * hoy y el fin de lo ya cubierto (prueba incluida). Es la regla 3: pagar
 * antes no hace perder días.
 */
export function nextPeriodStart(facts: SubscriptionFacts, now: Date): Date {
  return maxDate([now, effectiveTrialEnd(facts), paidUntil(facts)]) as Date;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  canWrite: boolean;
  /** Hasta cuándo puede escribir, gracia incluida. `null` en `sin_iniciar` o `vencida`. */
  accessUntil: Date | null;
  trialDaysLeft: number | null;
}

/**
 * ¿Hay un período pago que cubra este instante? Un período pago por
 * adelantado durante la prueba (regla 3) todavía NO cubre: arranca cuando
 * termina la prueba, y hasta entonces rige el tope de 3 obras.
 */
function coveredByPaidPeriod(facts: SubscriptionFacts, now: Date): boolean {
  const byPeriod = facts.periods.some(
    (p) => p.status === 'aprobado' && p.start <= now && now < p.end,
  );
  const byStripe =
    facts.stripe?.status === 'active' &&
    facts.stripe.currentPeriodStart <= now &&
    now < facts.stripe.currentPeriodEnd;
  return byPeriod || byStripe;
}

/** El estado de la suscripción en este momento. Derivado, nunca guardado. */
export function subscriptionState(facts: SubscriptionFacts, now: Date): SubscriptionState {
  const trialEnd = effectiveTrialEnd(facts);
  const paid = paidUntil(facts);

  if (coveredByPaidPeriod(facts, now)) {
    return { status: 'activa', canWrite: true, accessUntil: paid, trialDaysLeft: null };
  }

  if (trialEnd && facts.trialStartedAt && now < trialEnd) {
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / DAY_MS);
    // Si ya pagó por adelantado, el acceso sigue después de la prueba.
    const accessUntil = maxDate([trialEnd, paid]);
    return { status: 'prueba', canWrite: true, accessUntil, trialDaysLeft: daysLeft };
  }

  // Un pago en Bs mandado y sin revisar: acceso completo durante la gracia.
  const pendingGraceEnds = maxDate(
    facts.periods
      .filter((p) => p.status === 'pendiente')
      .map((p) => addHours(p.submittedAt, PLAN.graceHours)),
  );
  if (pendingGraceEnds && now < pendingGraceEnds) {
    return { status: 'en_revision', canWrite: true, accessUntil: pendingGraceEnds, trialDaysLeft: null };
  }

  // Stripe no pudo cobrar la renovación y está reintentando.
  if (facts.stripe?.status === 'past_due') {
    const graceEnds = addHours(facts.stripe.currentPeriodStart, PLAN.graceHours);
    if (now < graceEnds) {
      return { status: 'pago_fallido', canWrite: true, accessUntil: graceEnds, trialDaysLeft: null };
    }
  }

  if (!facts.trialStartedAt && !paid) {
    // Nunca empezó: puede crear su primera obra, y eso le arranca la prueba.
    return { status: 'sin_iniciar', canWrite: true, accessUntil: null, trialDaysLeft: null };
  }

  return { status: 'vencida', canWrite: false, accessUntil: null, trialDaysLeft: null };
}

// ─────────────────────────────── Obras ───────────────────────────────

export interface BillableProject {
  id: string;
  createdAt: Date;
  archivedAt?: Date | null;
}

/** Un tramo de la papelera: desde que se eliminó hasta que se restauró. */
export interface TrashedPeriod {
  from: Date;
  to: Date;
}

export interface ProjectLifecycle {
  id: string;
  createdAt: Date;
  archivedAt?: Date | null;
  /** Si está en la papelera ahora: desde cuándo. */
  deletedAt?: Date | null;
  /** Veces que estuvo en la papelera y volvió. */
  trashedPeriods?: TrashedPeriod[];
}

/**
 * La vida de una obra como obras facturables: **un tramo por cada vez que
 * estuvo en pie**. Una obra que nunca se eliminó es un solo tramo; una que se
 * eliminó y se restauró son dos, y el segundo "nace" al restaurar.
 *
 * Es lo que hace que eliminar no sea un agujero de facturación:
 * - eliminar cierra el tramo, no lo borra — lo usado hasta ahí se sigue
 *   cobrando, igual que si se archivara (regla 6);
 * - restaurar abre un tramo nuevo, que `quoteCharge` trata como una obra
 *   creada ese día: se prorratea si supera lo pago. Nadie recupera una
 *   cuarta obra gratis, ni la elimina el día 29 para no pagarla.
 *
 * Los tramos siguientes al primero llevan el id `<id>#<n>` para que sean
 * obras distintas ante el resto de las reglas.
 */
export function billableWindows(project: ProjectLifecycle): BillableProject[] {
  const trashed = [...(project.trashedPeriods ?? [])].sort(
    (a, b) => a.from.getTime() - b.from.getTime(),
  );
  const archivedAt = project.archivedAt ?? null;

  // Dónde arranca y dónde termina cada tramo, antes de aplicar archivado/papelera final.
  const raw: Array<{ start: Date; end: Date | null }> = [];
  let start = project.createdAt;
  for (const period of trashed) {
    raw.push({ start, end: period.from });
    start = period.to;
  }
  raw.push({ start, end: project.deletedAt ?? null });

  const earliest = (a: Date | null, b: Date | null) =>
    a && b ? (a < b ? a : b) : (a ?? b);

  return raw
    .map(({ start, end }, index) => ({
      start,
      end: earliest(end, archivedAt),
      index,
    }))
    .filter(({ start, end }) => !end || end > start)
    .map(({ start, end, index }) => ({
      id: index === 0 ? project.id : `${project.id}#${index + 1}`,
      createdAt: start,
      archivedAt: end,
    }));
}

function isActiveAt(project: BillableProject, at: Date): boolean {
  return project.createdAt <= at && (!project.archivedAt || project.archivedAt > at);
}

/** Cuántas obras estaban activas en ese instante. */
export function activeProjectsAt(projects: BillableProject[], at: Date): number {
  return projects.filter((p) => isActiveAt(p, at)).length;
}

/**
 * ¿Esta obra nació como extra? Lo es si al crearla ya había 3 activas.
 * Desempata por id cuando dos se crean en el mismo milisegundo, así el
 * resultado no depende del orden en que llegan de la base.
 */
function activeBefore(project: BillableProject, projects: BillableProject[]): number {
  return projects.filter(
    (other) =>
      other.id !== project.id &&
      isActiveAt(other, project.createdAt) &&
      (other.createdAt < project.createdAt ||
        (other.createdAt.getTime() === project.createdAt.getTime() && other.id < project.id)),
  ).length;
}

export type CreateProjectDecision =
  | { allowed: true; startsTrial: boolean; isExtra: boolean }
  | { allowed: false; code: 'SUBSCRIPTION_REQUIRED' | 'PAID_PLAN_REQUIRED' };

/**
 * ¿Puede crear una obra más?
 *
 * - Vencida → no (`SUBSCRIPTION_REQUIRED`).
 * - En prueba con 3 activas → no hasta activar el plan (`PAID_PLAN_REQUIRED`):
 *   la cuarta obra es lo que corta la prueba (regla 4).
 * - Con plan, la cuarta en adelante sí, y se marca como extra.
 */
export function canCreateProject(state: SubscriptionState, activeProjects: number): CreateProjectDecision {
  if (!state.canWrite) return { allowed: false, code: 'SUBSCRIPTION_REQUIRED' };

  const atLimit = activeProjects >= PLAN.includedProjects;

  if (state.status === 'sin_iniciar') return { allowed: true, startsTrial: true, isExtra: false };
  if (state.status === 'prueba' && atLimit) return { allowed: false, code: 'PAID_PLAN_REQUIRED' };

  return { allowed: true, startsTrial: false, isExtra: atLimit };
}

// ─────────────────────────────── Cobros ───────────────────────────────

export interface ChargeInput {
  periodStart: Date;
  /** Las obras de la Empresa, activas y archivadas. */
  projects: BillableProject[];
  /**
   * El período pago anterior, si lo hubo. Sin él no hay prorrateo: es el
   * caso de quien sale de la prueba, donde plan y extras arrancan juntos el
   * mismo día (regla 4).
   */
  previousPeriod?: {
    start: Date;
    end: Date;
    /**
     * Extras que ya se pagaron por adelantado en ese período. Sin el dato se
     * deducen de las obras activas al arrancarlo. Hace falta explícito cuando
     * se activó el plan desde la prueba para crear la cuarta: esa extra se
     * pagó antes de que la obra existiera.
     */
    prepaidExtras?: number;
  } | null;
}

/**
 * Lo que se cobra por un período que arranca en `periodStart`:
 *
 * - el plan base;
 * - cada obra activa al arrancar más allá de la tercera, mes completo;
 * - el prorrateo de las extras que se crearon durante el período anterior,
 *   por los días que le quedaban. Si después se archivaron igual se cobran:
 *   archivar no devuelve días (regla 6).
 */
export function quoteCharge(input: ChargeInput): ChargeQuote {
  const { periodStart, projects, previousPeriod } = input;
  const periodEnd = addMonths(periodStart, 1);
  const lines: ChargeLine[] = [
    { kind: 'base', quantity: 1, unitUsd: PLAN.basePriceUsd, amountUsd: PLAN.basePriceUsd },
  ];

  const extras = Math.max(0, activeProjectsAt(projects, periodStart) - PLAN.includedProjects);
  if (extras > 0) {
    lines.push({
      kind: 'extra',
      quantity: extras,
      unitUsd: PLAN.extraProjectPriceUsd,
      amountUsd: round2(extras * PLAN.extraProjectPriceUsd),
    });
  }

  if (previousPeriod) {
    const length = previousPeriod.end.getTime() - previousPeriod.start.getTime();
    const prepaid =
      previousPeriod.prepaidExtras ??
      Math.max(0, activeProjectsAt(projects, previousPeriod.start) - PLAN.includedProjects);
    const paidSlots = PLAN.includedProjects + prepaid;
    const createdDuring = projects
      .filter((p) => p.createdAt > previousPeriod.start && p.createdAt < previousPeriod.end)
      .filter((p) => activeBefore(p, projects) >= paidSlots)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));

    for (const project of createdDuring) {
      const remaining = previousPeriod.end.getTime() - project.createdAt.getTime();
      lines.push({
        kind: 'prorrateo',
        quantity: 1,
        unitUsd: PLAN.extraProjectPriceUsd,
        amountUsd: round2((PLAN.extraProjectPriceUsd * remaining) / length),
        projectId: project.id,
        days: Math.ceil(remaining / DAY_MS),
      });
    }
  }

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    lines,
    totalUsd: round2(lines.reduce((sum, line) => sum + line.amountUsd, 0)),
  };
}

/**
 * Dólares a bolívares con la tasa BCV. Se redondea UNA vez, al final: la tasa
 * viene con 8 decimales y recortarla antes de multiplicar corre el monto.
 */
export function usdToBolivares(usd: number, bcvRate: number): number {
  return round2(usd * bcvRate);
}

/**
 * ¿La tasa nueva es creíble frente a la anterior? Un salto de más del 20% de
 * un día para otro es mucho más probable que sea un error de lectura del
 * sitio del BCV que una devaluación, y cobrar con esa tasa es cobrar mal.
 */
export function isPlausibleRate(next: number, previous: number | null, maxChange = 0.2): boolean {
  if (!Number.isFinite(next) || next <= 0) return false;
  if (previous === null || previous <= 0) return true;
  return Math.abs(next - previous) / previous <= maxChange;
}

// ─────────────────────────────── Recordatorios ───────────────────────────────

/** Días antes del fin del plan Gratis en que se avisa por mail. */
export const TRIAL_REMINDER_DAYS = [7, 3, 1] as const;

export type SubscriptionReminder =
  | { kind: 'trial_ending'; key: string; daysLeft: number; trialEndsAt: Date }
  | { kind: 'expired'; key: string; expiredAt: Date };

/**
 * ¿Qué mail de recordatorio le toca hoy a esta suscripción? `null` si ninguno.
 *
 * `sentKeys` son los que ya se mandaron (se guardan en la suscripción): cada
 * aviso sale una sola vez aunque la tarea corra varias veces por día.
 *
 * - **Fin del plan Gratis**, a 7, 3 y 1 día. Si la tarea no corrió unos días,
 *   sale sólo el que corresponde hoy, no los atrasados de golpe. No se avisa a
 *   quien ya dejó pago lo que sigue (período pago o tarjeta cargada): ya
 *   resolvió, el mail sería ruido.
 * - **Vencida**: una vez por vencimiento. La clave lleva la fecha en que
 *   venció, así si renueva y vuelve a vencer meses después, se avisa de nuevo.
 */
export function dueReminder(
  facts: SubscriptionFacts,
  now: Date,
  sentKeys: readonly string[],
): SubscriptionReminder | null {
  const state = subscriptionState(facts, now);
  const trialEnd = effectiveTrialEnd(facts);
  const paid = paidUntil(facts);

  if (state.status === 'prueba' && trialEnd && state.trialDaysLeft !== null) {
    const alreadyPaidAhead =
      (paid !== null && paid > trialEnd) ||
      facts.stripe?.status === 'trialing' ||
      facts.stripe?.status === 'active';
    if (alreadyPaidAhead) return null;

    // El escalón más chico que todavía alcanza a los días que quedan.
    const bucket = [...TRIAL_REMINDER_DAYS]
      .sort((a, b) => a - b)
      .find((days) => state.trialDaysLeft! <= days);
    if (bucket === undefined) return null;

    const key = `trial-${bucket}`;
    if (sentKeys.includes(key)) return null;
    return { kind: 'trial_ending', key, daysLeft: state.trialDaysLeft, trialEndsAt: trialEnd };
  }

  if (state.status === 'vencida') {
    const expiredAt = maxDate([trialEnd, paid]);
    if (!expiredAt) return null;
    const key = `expired-${expiredAt.toISOString().slice(0, 10)}`;
    if (sentKeys.includes(key)) return null;
    return { kind: 'expired', key, expiredAt };
  }

  return null;
}
