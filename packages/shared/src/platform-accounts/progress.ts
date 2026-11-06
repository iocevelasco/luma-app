import type { SubscriptionStatus } from '../types/subscription.js';

/**
 * Cómo le va a una cuenta con membresía: en qué etapa del uso está y si hay
 * que escribirle. Puro y con tests; la API lee los hechos de la base y le
 * pregunta a esto, la UI muestra lo que la API resolvió.
 *
 * Todo sale de datos que ya existen. "Acción" es lo mismo que cuenta
 * Actividad (`PLATFORM_ACTION_OWNER`): no es un ingreso a la app. Una persona
 * que mira sin cargar nada se ve como inactiva.
 */

/** Las etapas del embudo, en orden. Para llegar a una hay que haber pasado por las anteriores. */
export const ACCOUNT_STAGES = [
  'registered',
  'emailConfirmed',
  'firstProject',
  'firstInvite',
  'firstPlanning',
  'firstMoney',
] as const;
export type AccountStage = (typeof ACCOUNT_STAGES)[number];

/** Hechos de una cuenta que deciden su etapa. */
export interface AccountProgressFacts {
  emailVerified: boolean;
  /** Obras que creó (`projectCreated`). */
  projects: number;
  /** Personas que invitó a una obra (`memberInvited`). */
  invites: number;
  /** Actividades creadas o presupuestos importados. */
  planning: number;
  /** Gastos o cobros registrados. */
  money: number;
}

/**
 * Las etapas que alcanzó, en orden. Es una cadena: una etapa cuenta solo si
 * la anterior también, así el embudo nunca crece hacia abajo.
 *
 * "Correo confirmado" vale también para quien ya creó una obra: una cuenta que
 * se activó por un enlace de invitación sigue con `email_verified: false` y
 * trabaja igual; marcarla como "no confirmó" sería una falsa alarma.
 */
export function reachedStages(facts: AccountProgressFacts): AccountStage[] {
  const satisfied: Record<AccountStage, boolean> = {
    registered: true,
    emailConfirmed: facts.emailVerified || facts.projects > 0,
    firstProject: facts.projects > 0,
    firstInvite: facts.invites > 0,
    firstPlanning: facts.planning > 0,
    firstMoney: facts.money > 0,
  };
  const reached: AccountStage[] = [];
  for (const stage of ACCOUNT_STAGES) {
    if (!satisfied[stage]) break;
    reached.push(stage);
  }
  return reached;
}

/** La última etapa de la cadena. */
export function currentStage(facts: AccountProgressFacts): AccountStage {
  const reached = reachedStages(facts);
  return reached[reached.length - 1];
}

/** Cuántos días desde el alta cuenta una cuenta como recién llegada. */
export const NEW_ACCOUNT_DAYS = 3;
/** Cuántos días sin ninguna acción para decir que se enfrió. */
export const COLD_DAYS = 7;
/** A cuántos días del fin de la prueba se avisa. */
export const TRIAL_ENDING_DAYS = 7;

export const ACCOUNT_HEALTH_KEYS = [
  'expired',
  'paymentFailed',
  'paymentReview',
  'unconfirmed',
  'noProject',
  'cold',
  'trialEnding',
  'new',
  'ok',
] as const;
export type AccountHealthKey = (typeof ACCOUNT_HEALTH_KEYS)[number];

export interface AccountHealthFacts {
  status: SubscriptionStatus;
  stage: AccountStage;
  daysSinceJoined: number;
  /** `null` si nunca hizo una acción registrada. */
  daysSinceLastAction: number | null;
  /** Solo en prueba. */
  trialDaysLeft: number | null;
}

export interface AccountHealth {
  key: AccountHealthKey;
  /** Hay que mirarla: va en "necesitan atención". */
  risk: boolean;
}

const RISK: Record<AccountHealthKey, boolean> = {
  expired: true,
  paymentFailed: true,
  paymentReview: true,
  unconfirmed: true,
  noProject: true,
  cold: true,
  trialEnding: true,
  new: false,
  ok: false,
};

/**
 * El semáforo de una cuenta con membresía. La primera regla que aplica gana;
 * el orden es el de urgencia:
 *
 * 1. Membresía vencida: está en solo lectura.
 * 2. Pago fallido o en revisión: la plata está en juego ahora.
 * 3. No confirmó el correo o no creó su primera obra, pasados 3 días del alta.
 * 4. Se enfrió: 7 días o más sin ninguna acción (desde el alta si nunca hizo una).
 * 5. Prueba por vencer, sin gasto ni cobro cargados todavía.
 * 6. Recién llegó, antes de los 3 días.
 *
 * El plan ilimitado no tiene prueba que vencer, así que no entra en la regla 5.
 */
export function accountHealth(facts: AccountHealthFacts): AccountHealth {
  const done = (key: AccountHealthKey): AccountHealth => ({ key, risk: RISK[key] });

  if (facts.status === 'vencida') return done('expired');
  if (facts.status === 'pago_fallido') return done('paymentFailed');
  if (facts.status === 'en_revision') return done('paymentReview');

  const blocked = facts.stage === 'registered' || facts.stage === 'emailConfirmed';
  if (blocked && facts.daysSinceJoined >= NEW_ACCOUNT_DAYS) {
    return done(facts.stage === 'registered' ? 'unconfirmed' : 'noProject');
  }

  const idle = facts.daysSinceLastAction ?? facts.daysSinceJoined;
  if (!blocked && idle >= COLD_DAYS) return done('cold');

  if (
    facts.status === 'prueba' &&
    facts.trialDaysLeft !== null &&
    facts.trialDaysLeft <= TRIAL_ENDING_DAYS &&
    facts.stage !== 'firstMoney'
  ) {
    return done('trialEnding');
  }

  if (facts.daysSinceJoined < NEW_ACCOUNT_DAYS) return done('new');
  return done('ok');
}
