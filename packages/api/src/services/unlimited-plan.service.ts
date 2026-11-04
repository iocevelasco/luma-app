import { startTrial } from '@luma/shared';
import { Subscription } from '../models/Subscription.js';
import { notFound } from '../utils/errors.js';
import { findMyOrganizationId } from './organization.service.js';
import { cancelStripeBilling } from './stripe.service.js';

/**
 * Asigna o quita el plan ilimitado de la empresa que esta cuenta es dueña.
 * Lo llama sólo el admin de la plataforma. Al asignarlo, si había un cobro
 * con tarjeta, se da de baja para que no siga pagando.
 */
export async function setAccountUnlimited(
  userId: string,
  unlimited: boolean,
): Promise<{ unlimited: boolean }> {
  const organizationId = await findMyOrganizationId(userId);
  if (!organizationId) throw notFound('Esta cuenta no tiene una empresa propia.');

  if (!unlimited) {
    await Subscription.updateOne({ organization: organizationId }, { $set: { unlimited: false } });
    return { unlimited: false };
  }

  const existing = await Subscription.findOne({ organization: organizationId });
  if (existing) {
    await cancelStripeBilling(existing);
    if (!existing.unlimited) {
      existing.unlimited = true;
      await existing.save();
    }
    return { unlimited: true };
  }

  const { trialStartedAt, trialEndsAt } = startTrial(new Date());
  await Subscription.create({
    organization: organizationId,
    owner: userId,
    trialStartedAt,
    trialEndsAt,
    unlimited: true,
  });
  return { unlimited: true };
}
