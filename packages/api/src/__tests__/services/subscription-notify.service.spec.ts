import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/Subscription.js', () => ({
  Subscription: { find: vi.fn(), findOne: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('../../models/OrganizationMember.js', () => ({ OrganizationMember: { findOne: vi.fn() } }));
vi.mock('../../models/Organization.js', () => ({
  Organization: { findById: () => ({ select: () => Promise.resolve({ name: 'Obras Ana' }) }) },
}));
vi.mock('../../models/User.js', () => ({ User: { findById: vi.fn(), find: vi.fn() } }));
vi.mock('../../services/email.service.js', () => ({
  EmailService: {
    sendSubscriptionPaymentApproved: vi.fn().mockResolvedValue(true),
    sendSubscriptionPaymentRejected: vi.fn().mockResolvedValue(true),
    sendSubscriptionPaymentToReview: vi.fn().mockResolvedValue(true),
    sendTrialEnding: vi.fn().mockResolvedValue(true),
    sendSubscriptionExpired: vi.fn().mockResolvedValue(true),
    sendCardPaymentFailed: vi.fn().mockResolvedValue(true),
  },
}));
vi.mock('../../services/subscription.service.js', () => ({ loadFacts: vi.fn() }));
vi.mock('../../services/subscription-payment.service.js', () => ({
  hasAmountMismatch: () => true,
}));

const { Subscription } = await import('../../models/Subscription.js');
const { User } = await import('../../models/User.js');
const { EmailService } = await import('../../services/email.service.js');
const { loadFacts } = await import('../../services/subscription.service.js');
const notify = await import('../../services/subscription-notify.service.js');

const d = (iso: string) => new Date(iso);
const ana = { email: 'ana@obra.test', name: 'Ana' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(Subscription.findOne).mockReturnValue({
    select: () => Promise.resolve({ owner: 'user-1' }),
  } as never);
  vi.mocked(User.findById).mockReturnValue({ select: () => Promise.resolve(ana) } as never);
});

describe('avisos de un pago revisado', () => {
  it('aprobado: le avisa al dueño hasta cuándo es Pro', async () => {
    const periodEnd = d('2026-11-20T00:00:00Z');
    await notify.notifyPaymentReviewed({ organization: 'org-1', status: 'aprobado', periodEnd } as never);
    expect(EmailService.sendSubscriptionPaymentApproved).toHaveBeenCalledWith('ana@obra.test', 'Ana', periodEnd);
  });

  it('rechazado: le manda el motivo', async () => {
    await notify.notifyPaymentReviewed({
      organization: 'org-1',
      status: 'rechazado',
      rejectionReason: 'La referencia no aparece',
    } as never);
    expect(EmailService.sendSubscriptionPaymentRejected).toHaveBeenCalledWith(
      'ana@obra.test',
      'Ana',
      'La referencia no aparece',
    );
  });

  it('un fallo del mail no se propaga: la revisión ya quedó hecha', async () => {
    vi.mocked(EmailService.sendSubscriptionPaymentApproved).mockRejectedValueOnce(new Error('Resend caído'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(
      notify.notifyPaymentReviewed({ organization: 'org-1', status: 'aprobado', periodEnd: new Date() } as never),
    ).resolves.toBeUndefined();
  });
});

describe('aviso a los admins', () => {
  it('le escribe a cada admin con el monto declarado y el aviso de que no coincide', async () => {
    vi.mocked(User.find).mockReturnValue({
      select: () => Promise.resolve([{ email: 'a1@luma.test' }, { email: 'a2@luma.test' }]),
    } as never);

    await notify.notifyPaymentToReview({
      organization: 'org-1',
      amountBs: 34393.2,
      declaredAmountBs: 32673.54,
      totalUsd: 39,
    } as never);

    expect(EmailService.sendSubscriptionPaymentToReview).toHaveBeenCalledTimes(2);
    expect(EmailService.sendSubscriptionPaymentToReview).toHaveBeenCalledWith('a1@luma.test', {
      organization: 'Obras Ana',
      owner: 'ana@obra.test',
      amountBs: 'Bs. 32.673,54',
      totalUsd: '$39.00',
      mismatch: true,
    });
  });
});

describe('sendDueReminders', () => {
  const trialFacts = (endIso: string) => ({
    trialStartedAt: new Date(d(endIso).getTime() - 30 * 86_400_000),
    trialEndsAt: d(endIso),
    trialEndedEarlyAt: null,
    periods: [],
    stripe: null,
  });

  it('manda el que toca y lo marca como enviado', async () => {
    vi.mocked(Subscription.find).mockReturnValue({
      select: () => Promise.resolve([{ _id: 's1', organization: 'org-1', remindersSent: [] }]),
    } as never);
    vi.mocked(loadFacts).mockResolvedValue(trialFacts('2026-10-31T00:00:00Z'));

    const run = await notify.sendDueReminders(d('2026-10-28T12:00:00Z')); // quedan 3 días

    expect(EmailService.sendTrialEnding).toHaveBeenCalledWith(
      'ana@obra.test',
      'Ana',
      3,
      d('2026-10-31T00:00:00Z'),
      expect.any(Boolean), // si se ofrece tarjeta: el mail no la menciona si está apagada
    );
    expect(Subscription.updateOne).toHaveBeenCalledWith({ _id: 's1' }, { $addToSet: { remindersSent: 'trial-3' } });
    expect(run).toEqual({ checked: 1, sent: 1, failed: 0 });
  });

  it('si el mail no salió (sin Resend), no lo marca: sale en la próxima corrida', async () => {
    vi.mocked(Subscription.find).mockReturnValue({
      select: () => Promise.resolve([{ _id: 's1', organization: 'org-1', remindersSent: [] }]),
    } as never);
    vi.mocked(loadFacts).mockResolvedValue(trialFacts('2026-10-20T00:00:00Z')); // ya venció
    vi.mocked(EmailService.sendSubscriptionExpired).mockResolvedValueOnce(false);

    const run = await notify.sendDueReminders(d('2026-10-28T12:00:00Z'));

    expect(EmailService.sendSubscriptionExpired).toHaveBeenCalled();
    expect(Subscription.updateOne).not.toHaveBeenCalled();
    expect(run.failed).toBe(1);
  });

  it('lo que ya se mandó no se repite', async () => {
    vi.mocked(Subscription.find).mockReturnValue({
      select: () => Promise.resolve([{ _id: 's1', organization: 'org-1', remindersSent: ['trial-3'] }]),
    } as never);
    vi.mocked(loadFacts).mockResolvedValue(trialFacts('2026-10-31T00:00:00Z'));

    const run = await notify.sendDueReminders(d('2026-10-28T12:00:00Z'));

    expect(EmailService.sendTrialEnding).not.toHaveBeenCalled();
    expect(run).toEqual({ checked: 1, sent: 0, failed: 0 });
  });
});
