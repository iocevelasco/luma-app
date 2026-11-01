/**
 * Campañas de correo que el admin de la plataforma manda a las cuentas de Luma.
 * Un comunicado, no un correo transaccional: lleva baja y sólo llega a quien no
 * la pidió.
 */

export const CAMPAIGN_STATUSES = ['draft', 'sending', 'sent'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface Campaign {
  id: string;
  title: string;
  body: string;
  /** Dirección pública de la imagen, la que lleva el correo. `null` si no tiene. */
  imageUrl: string | null;
  status: CampaignStatus;
  /** Cuántas cuentas la recibían al enviarla. 0 mientras es borrador. */
  recipients: number;
  /** Cuántos correos salieron. */
  sent: number;
  /** Cuántos no pudieron salir. */
  failed: number;
  createdAt: string;
  sentAt: string | null;
}

/** A cuántas cuentas llegaría una campaña si se enviara ahora. */
export interface CampaignAudience {
  recipients: number;
}
