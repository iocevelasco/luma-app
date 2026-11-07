import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_STAGES,
  COLD_DAYS,
  NEW_ACCOUNT_DAYS,
  TRIAL_ENDING_DAYS,
  accountHealth,
  currentStage,
  reachedStages,
  type AccountHealthFacts,
  type AccountProgressFacts,
} from '../index';

const none: AccountProgressFacts = {
  emailVerified: false,
  projects: 0,
  invites: 0,
  planning: 0,
  money: 0,
};

describe('reachedStages', () => {
  it('una cuenta recién registrada está en la primera etapa', () => {
    expect(reachedStages(none)).toEqual(['registered']);
    expect(currentStage(none)).toBe('registered');
  });

  it('avanza en orden hasta la última', () => {
    const all = { emailVerified: true, projects: 1, invites: 2, planning: 3, money: 4 };
    expect(reachedStages(all)).toEqual([...ACCOUNT_STAGES]);
    expect(currentStage(all)).toBe('firstMoney');
  });

  it('es una cadena: un gasto sin invitados no salta la etapa de invitar', () => {
    expect(
      currentStage({ emailVerified: true, projects: 1, invites: 0, planning: 5, money: 5 }),
    ).toBe('firstProject');
  });

  it('quien creó una obra tiene el correo por confirmado, aunque email_verified sea false', () => {
    // Se activó por un enlace de invitación: la cuenta trabaja y no es una falsa alarma.
    expect(currentStage({ ...none, emailVerified: false, projects: 1 })).toBe('firstProject');
  });

  it('confirmar el correo sin crear obra deja en la segunda etapa', () => {
    expect(currentStage({ ...none, emailVerified: true })).toBe('emailConfirmed');
  });
});

describe('accountHealth', () => {
  const base: AccountHealthFacts = {
    status: 'prueba',
    stage: 'firstInvite',
    daysSinceJoined: 12,
    daysSinceLastAction: 1,
    trialDaysLeft: 18,
  };

  it('sin señales de riesgo está en marcha', () => {
    expect(accountHealth(base)).toEqual({ key: 'ok', risk: false });
  });

  it('membresía vencida gana sobre todo lo demás', () => {
    expect(accountHealth({ ...base, status: 'vencida', daysSinceLastAction: 0 })).toEqual({
      key: 'expired',
      risk: true,
    });
  });

  it('un pago fallido o en revisión es riesgo, aunque la cuenta trabaje', () => {
    expect(accountHealth({ ...base, status: 'pago_fallido' })).toEqual({
      key: 'paymentFailed',
      risk: true,
    });
    expect(accountHealth({ ...base, status: 'en_revision' })).toEqual({
      key: 'paymentReview',
      risk: true,
    });
  });

  it('sin correo confirmado o sin primera obra, pasados 3 días, es riesgo', () => {
    expect(
      accountHealth({ ...base, stage: 'registered', daysSinceJoined: NEW_ACCOUNT_DAYS }),
    ).toEqual({ key: 'unconfirmed', risk: true });
    expect(
      accountHealth({ ...base, stage: 'emailConfirmed', daysSinceJoined: NEW_ACCOUNT_DAYS }),
    ).toEqual({ key: 'noProject', risk: true });
  });

  it('antes de los 3 días es recién llegada, no una cuenta trabada', () => {
    expect(
      accountHealth({
        ...base,
        stage: 'registered',
        daysSinceJoined: NEW_ACCOUNT_DAYS - 1,
        daysSinceLastAction: null,
      }),
    ).toEqual({ key: 'new', risk: false });
  });

  it('se enfría con 7 días o más sin ninguna acción', () => {
    expect(accountHealth({ ...base, daysSinceLastAction: COLD_DAYS })).toEqual({
      key: 'cold',
      risk: true,
    });
    expect(accountHealth({ ...base, daysSinceLastAction: COLD_DAYS - 1 }).key).toBe('ok');
  });

  it('sin ninguna acción registrada cuenta los días desde el alta', () => {
    expect(
      accountHealth({ ...base, daysSinceJoined: 10, daysSinceLastAction: null }).key,
    ).toBe('cold');
  });

  it('prueba por vencer, salvo que ya haya cargado un gasto o un cobro', () => {
    expect(accountHealth({ ...base, trialDaysLeft: TRIAL_ENDING_DAYS })).toEqual({
      key: 'trialEnding',
      risk: true,
    });
    expect(
      accountHealth({ ...base, trialDaysLeft: TRIAL_ENDING_DAYS, stage: 'firstMoney' }).key,
    ).toBe('ok');
    expect(accountHealth({ ...base, trialDaysLeft: TRIAL_ENDING_DAYS + 1 }).key).toBe('ok');
  });

  it('el plan ilimitado no tiene prueba que vencer', () => {
    expect(accountHealth({ ...base, status: 'ilimitado', trialDaysLeft: null }).key).toBe('ok');
  });

  it('una cuenta que pagó ya no está en prueba por vencer', () => {
    expect(accountHealth({ ...base, status: 'activa', trialDaysLeft: null }).key).toBe('ok');
  });
});
