import type { FilterQuery } from 'mongoose';
import type { Campaign as CampaignDTO } from '@luma/shared';
import { SERVER_CONFIG } from '../config/app.config.js';
import { Campaign, type ICampaign } from '../models/Campaign.js';
import { User, type IUser } from '../models/User.js';
import { conflict } from '../utils/errors.js';
import { unsubscribeUrl } from '../utils/unsubscribe.js';
import { sendCampaignEmail } from './email.service.js';

/** Cuántos correos salen a la vez: Resend limita por segundo. */
const BATCH_SIZE = 5;
const BATCH_PAUSE_MS = 600;

/**
 * Quién recibe un comunicado: cuentas activas, con el mail confirmado, que no
 * pidieron la baja y no se purgaron. Las `@luma.test` son de prueba, no gente.
 */
export const AUDIENCE: FilterQuery<IUser> = {
  account_status: 'active',
  enabled: true,
  email_verified: true,
  marketing_opt_out: { $ne: true },
  purgedAt: { $exists: false },
  email: { $not: /@luma\.test$/i },
};

export const countAudience = () => User.countDocuments(AUDIENCE);

export function campaignImageUrl(id: string): string {
  return `${SERVER_CONFIG.PUBLIC_API_URL.replace(/\/$/, '')}/api/public/campaigns/${id}/image`;
}

export function toCampaignDTO(c: ICampaign): CampaignDTO {
  return {
    id: String(c._id),
    title: c.title,
    body: c.body,
    imageUrl: c.imageKey ? campaignImageUrl(String(c._id)) : null,
    status: c.status,
    recipients: c.recipients,
    sent: c.sent,
    failed: c.failed,
    createdAt: c.createdAt.toISOString(),
    sentAt: c.sentAt?.toISOString() ?? null,
  };
}

export const sendCampaignTo = (campaign: ICampaign, user: { _id: unknown; email: string; name: string }) =>
  sendCampaignEmail({
    to: user.email,
    name: user.name,
    title: campaign.title,
    body: campaign.body,
    imageUrl: campaign.imageKey ? campaignImageUrl(String(campaign._id)) : null,
    unsubscribeUrl: unsubscribeUrl(String(user._id)),
  });

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Pasa la campaña de borrador a enviándose (atómico: un segundo intento ve
 * `sending` y falla) y la manda en segundo plano. Devuelve apenas queda
 * marcada; el resultado se ve en `sent` / `failed`.
 *
 * Primero se reclama y después se arma la audiencia: un doble clic o una
 * campaña ya enviada no pagan la consulta de todas las cuentas.
 */
export async function startCampaign(id: string): Promise<ICampaign> {
  const campaign = await Campaign.findOneAndUpdate(
    { _id: id, status: 'draft' },
    { status: 'sending', recipients: 0, sent: 0, failed: 0 },
    { new: true },
  );
  if (!campaign) throw conflict('Esta campaña ya se envió o se está enviando.');

  let recipients: Recipient[];
  try {
    recipients = await User.find(AUDIENCE).select('_id email name').lean();
    await Campaign.updateOne({ _id: campaign._id }, { recipients: recipients.length });
  } catch (error) {
    // Sin audiencia no salió nada: vuelve a borrador para poder reintentar.
    await Campaign.updateOne({ _id: campaign._id }, { status: 'draft' }).catch(() => undefined);
    throw error;
  }
  campaign.recipients = recipients.length;

  void deliver(campaign, recipients);
  return campaign;
}

type Recipient = { _id: unknown; email: string; name: string };

/**
 * De esta tanda, quién sigue siendo audiencia: el envío dura minutos y alguien
 * puede haberse dado de baja (o desactivado) desde que se armó la lista.
 */
async function stillInAudience(batch: Recipient[]): Promise<Recipient[]> {
  const ids = await User.find({ ...AUDIENCE, _id: { $in: batch.map((user) => user._id) } })
    .select('_id')
    .lean();
  const allowed = new Set(ids.map((user) => String(user._id)));
  return batch.filter((user) => allowed.has(String(user._id)));
}

async function deliver(campaign: ICampaign, recipients: Recipient[]): Promise<void> {
  let sent = 0;
  let failed = 0;
  try {
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = await stillInAudience(recipients.slice(i, i + BATCH_SIZE));
      const results = await Promise.all(batch.map((user) => sendCampaignTo(campaign, user)));
      for (const ok of results) {
        if (ok) sent += 1;
        else failed += 1;
      }
      await Campaign.updateOne({ _id: campaign._id }, { sent, failed });
      if (i + BATCH_SIZE < recipients.length) await pause(BATCH_PAUSE_MS);
    }
  } catch (error) {
    console.error(`❌ [CAMPAÑA] Falló el envío de ${campaign._id}:`, error);
  } finally {
    await Campaign.updateOne(
      { _id: campaign._id },
      // `recipients` queda en a cuántas cuentas se les intentó mandar: quien se
      // dio de baja a mitad de camino no cuenta ni como enviado ni como fallido.
      { status: 'sent', recipients: sent + failed, sent, failed, sentAt: new Date() },
    ).catch((error) => console.error('❌ [CAMPAÑA] No se pudo cerrar:', error));
  }
}
