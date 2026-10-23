import mongoose from 'mongoose';
import { dueReminder } from '@luma/shared';
import { STRIPE_CONFIG } from '../config/app.config.js';
import { Organization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Subscription } from '../models/Subscription.js';
import type { ISubscriptionPayment } from '../models/SubscriptionPayment.js';
import { User } from '../models/User.js';
import { EmailService } from './email.service.js';
import { hasAmountMismatch } from './subscription-payment.service.js';
import { loadFacts } from './subscription.service.js';

/**
 * A quién avisar y de qué, cuando pasa algo con la suscripción.
 *
 * Mismo criterio que las notificaciones de obra: **un aviso que falla nunca
 * voltea la acción que lo disparó**. Aprobar un pago no puede fallar porque
 * Resend estaba caído; se loguea y se sigue. Por eso todo lo de acá atrapa
 * sus errores.
 */

type OrgId = mongoose.Types.ObjectId | string;

/** Quien paga: el dueño de la Empresa. */
async function ownerOf(organizationId: OrgId): Promise<{ email: string; name: string } | null> {
  const subscription = await Subscription.findOne({ organization: organizationId }).select('owner');
  const ownerId =
    subscription?.owner ??
    (await OrganizationMember.findOne({ organization: organizationId, role: 'owner' }).select('user'))
      ?.user;
  if (!ownerId) return null;
  const user = await User.findById(ownerId).select('email name');
  return user ? { email: user.email, name: user.name } : null;
}

function safely(label: string, task: () => Promise<unknown>): Promise<void> {
  return task()
    .then(() => undefined)
    .catch((error) => console.error(`❌ [SUBSCRIPTION] ${label}:`, error));
}

const bs = (amount: number | null) =>
  amount == null
    ? '—'
    : `Bs. ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd = (amount: number) => `$${amount.toFixed(2)}`;

/** Al dueño: su pago en Bs fue aprobado o rechazado. */
export function notifyPaymentReviewed(payment: ISubscriptionPayment): Promise<void> {
  return safely('aviso de pago revisado', async () => {
    const owner = await ownerOf(payment.organization);
    if (!owner) return;
    if (payment.status === 'aprobado') {
      await EmailService.sendSubscriptionPaymentApproved(owner.email, owner.name, payment.periodEnd);
    } else if (payment.status === 'rechazado') {
      await EmailService.sendSubscriptionPaymentRejected(
        owner.email,
        owner.name,
        payment.rejectionReason ?? '',
      );
    }
  });
}

/** A los admins de la plataforma: entró un pago en Bs para revisar. */
export function notifyPaymentToReview(payment: ISubscriptionPayment): Promise<void> {
  return safely('aviso de pago a revisar', async () => {
    const [admins, organization, owner] = await Promise.all([
      User.find({ role: 'admin', enabled: { $ne: false } }).select('email'),
      Organization.findById(payment.organization).select('name'),
      ownerOf(payment.organization),
    ]);
    const details = {
      organization: organization?.name ?? 'Una Empresa',
      owner: owner?.email ?? '—',
      amountBs: bs(payment.declaredAmountBs ?? payment.amountBs),
      totalUsd: usd(payment.totalUsd),
      mismatch: hasAmountMismatch(payment),
    };
    await Promise.all(
      admins.map((admin) => EmailService.sendSubscriptionPaymentToReview(admin.email, details)),
    );
  });
}

/** Al dueño: Stripe no pudo cobrar la renovación. */
export function notifyCardPaymentFailed(organizationId: OrgId): Promise<void> {
  return safely('aviso de cobro fallido', async () => {
    const owner = await ownerOf(organizationId);
    if (owner) await EmailService.sendCardPaymentFailed(owner.email, owner.name);
  });
}

export interface ReminderRun {
  checked: number;
  sent: number;
  failed: number;
}

/**
 * Recorre las suscripciones y manda el recordatorio que le toque a cada una
 * hoy (fin del plan Gratis a 7, 3 y 1 día; vencida). Lo corre una tarea
 * programada una vez por día; correrla de más no duplica nada.
 *
 * La clave del aviso se guarda recién si el mail salió: sin Resend
 * configurado (desarrollo) no se marca nada y no se pierde ningún aviso.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<ReminderRun> {
  const run: ReminderRun = { checked: 0, sent: 0, failed: 0 };
  const subscriptions = await Subscription.find().select('organization remindersSent');

  for (const subscription of subscriptions) {
    run.checked += 1;
    try {
      const facts = await loadFacts(subscription.organization);
      const reminder = dueReminder(facts, now, subscription.remindersSent ?? []);
      if (!reminder) continue;

      const owner = await ownerOf(subscription.organization);
      if (!owner) continue;

      const sent =
        reminder.kind === 'trial_ending'
          ? await EmailService.sendTrialEnding(
              owner.email,
              owner.name,
              reminder.daysLeft,
              reminder.trialEndsAt,
              STRIPE_CONFIG.ENABLED,
            )
          : await EmailService.sendSubscriptionExpired(owner.email, owner.name, STRIPE_CONFIG.ENABLED);

      if (sent) {
        await Subscription.updateOne(
          { _id: subscription._id },
          { $addToSet: { remindersSent: reminder.key } },
        );
        run.sent += 1;
      } else {
        run.failed += 1;
      }
    } catch (error) {
      run.failed += 1;
      console.error(`❌ [SUBSCRIPTION] recordatorio de ${String(subscription.organization)}:`, error);
    }
  }
  return run;
}
