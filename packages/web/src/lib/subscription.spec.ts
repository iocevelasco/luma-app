import { describe, expect, it } from 'vitest';
import type { SubscriptionOverview } from '@luma/shared';
import { hasLiveCard, nextProjectState, subscriptionNotice } from './subscription';

function overview(patch: Partial<SubscriptionOverview> = {}): SubscriptionOverview {
  return {
    status: 'prueba',
    canWrite: true,
    accessUntil: null,
    trialEndsAt: null,
    trialDaysLeft: 20,
    activeProjects: 1,
    includedProjects: 3,
    nextCharge: null,
    paymentOptions: { card: true, bolivares: true },
    card: { status: null, manageable: false },
    ...patch,
  };
}

describe('subscriptionNotice', () => {
  it('callado en prueba mientras faltan más de 7 días, y cuando está activa', () => {
    expect(subscriptionNotice(overview({ trialDaysLeft: 8 }))).toBeNull();
    expect(subscriptionNotice(overview({ status: 'activa', trialDaysLeft: null }))).toBeNull();
    expect(subscriptionNotice(undefined)).toBeNull();
  });

  it('avisa la última semana de prueba con los días que quedan', () => {
    expect(subscriptionNotice(overview({ trialDaysLeft: 3 }))).toEqual({
      tone: 'warning',
      key: 'trialEnding',
      count: 3,
    });
  });

  it('en revisión, cobro fallido y vencida tienen cada uno su aviso', () => {
    expect(subscriptionNotice(overview({ status: 'en_revision' }))?.key).toBe('inReview');
    expect(subscriptionNotice(overview({ status: 'pago_fallido' }))?.tone).toBe('warning');
    expect(subscriptionNotice(overview({ status: 'vencida', canWrite: false }))).toEqual({
      tone: 'danger',
      key: 'expired',
    });
  });
});

describe('nextProjectState', () => {
  it('dentro de lo incluido: libre', () => {
    expect(nextProjectState(overview({ activeProjects: 2 }))).toBe('free');
  });

  it('en prueba con 3: la cuarta pide activar el plan', () => {
    expect(nextProjectState(overview({ activeProjects: 3 }))).toBe('trialLimit');
  });

  it('con plan y 3: la cuarta es extra', () => {
    expect(nextProjectState(overview({ status: 'activa', activeProjects: 3 }))).toBe('extra');
  });

  it('vencida: no se crea nada', () => {
    expect(nextProjectState(overview({ status: 'vencida', canWrite: false }))).toBe('expired');
  });

  it('un invitado que nunca creó obras: libre', () => {
    expect(nextProjectState(overview({ status: 'sin_iniciar', activeProjects: 0 }))).toBe('free');
  });
});

describe('hasLiveCard', () => {
  it('sólo con una suscripción de Stripe que no esté cancelada', () => {
    expect(hasLiveCard(overview())).toBe(false);
    expect(hasLiveCard(overview({ card: { status: 'active', manageable: true } }))).toBe(true);
    expect(hasLiveCard(overview({ card: { status: 'canceled', manageable: true } }))).toBe(false);
  });
});
