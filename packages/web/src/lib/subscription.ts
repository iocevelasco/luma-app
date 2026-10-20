import type { SubscriptionOverview } from '@luma/shared';

/**
 * Qué decirle a la persona sobre su suscripción, en una función pura: la
 * usan el aviso del panel y la pantalla de Suscripción, y se prueba sola.
 *
 * Las reglas (cuándo vence, cuánto se cobra) NO viven acá: vienen resueltas
 * del servidor. Esto sólo decide qué mostrar con lo que ya llegó.
 */

export type NoticeTone = 'info' | 'warning' | 'danger';

export interface SubscriptionNotice {
  tone: NoticeTone;
  /** Clave bajo `subscription.notice`. */
  key: 'trialEnding' | 'inReview' | 'paymentFailed' | 'expired';
  count?: number;
}

/** Desde cuántos días antes del fin de la prueba se avisa en todas las pantallas. */
export const TRIAL_WARNING_DAYS = 7;

/**
 * El aviso del panel, o `null` si no hay nada que decir. Callado a propósito
 * cuando todo está bien: un aviso que está siempre deja de leerse, y el día
 * que importa ya nadie lo ve.
 */
export function subscriptionNotice(
  subscription: SubscriptionOverview | undefined,
): SubscriptionNotice | null {
  if (!subscription) return null;
  switch (subscription.status) {
    case 'prueba':
      return subscription.trialDaysLeft !== null &&
        subscription.trialDaysLeft <= TRIAL_WARNING_DAYS
        ? { tone: 'warning', key: 'trialEnding', count: subscription.trialDaysLeft }
        : null;
    case 'en_revision':
      return { tone: 'info', key: 'inReview' };
    case 'pago_fallido':
      return { tone: 'warning', key: 'paymentFailed' };
    case 'vencida':
      return { tone: 'danger', key: 'expired' };
    default:
      return null;
  }
}

/**
 * Qué pasa si toca "Nueva obra" ahora.
 *
 * - `expired`: no puede crear nada; hay que renovar.
 * - `trialLimit`: en la prueba con 3 activas; la cuarta pide activar el plan.
 * - `extra`: con plan, la próxima es extra y suma $8 por mes.
 * - `free`: entra en lo incluido.
 */
export type NextProjectState = 'free' | 'extra' | 'trialLimit' | 'expired';

export function nextProjectState(subscription: SubscriptionOverview | undefined): NextProjectState {
  if (!subscription) return 'free';
  if (!subscription.canWrite) return 'expired';
  const atLimit = subscription.activeProjects >= subscription.includedProjects;
  if (!atLimit || subscription.status === 'sin_iniciar') return 'free';
  return subscription.status === 'prueba' ? 'trialLimit' : 'extra';
}

/** ¿Tiene una suscripción de Stripe viva? Entonces se gestiona en el portal, no se abre otro pago. */
export function hasLiveCard(subscription: SubscriptionOverview | undefined): boolean {
  const status = subscription?.card.status;
  return Boolean(status && !['canceled', 'incomplete_expired'].includes(status));
}
