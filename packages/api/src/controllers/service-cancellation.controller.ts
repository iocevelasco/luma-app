import type { Request, Response } from 'express';
import { ServiceCancellation } from '../models/ServiceCancellation.js';
import { User } from '../models/User.js';
import { EmailService } from '../services/email.service.js';
import { badRequest } from '../utils/errors.js';

const REASONS = ['noLongerUse', 'privacy', 'security', 'other'] as const;
type Reason = (typeof REASONS)[number];

const REASON_LABEL: Record<Reason, string> = {
  noLongerUse: 'Ya no uso el servicio',
  privacy: 'Privacidad',
  security: 'Seguridad',
  other: 'Otro',
};

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * `POST /api/legal/service-cancellation`. Público. Guarda el pedido y avisa
 * a los admins. No borra la cuenta ni cierra la sesión.
 */
export async function submitServiceCancellation(req: Request, res: Response) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const firstName = text(body.firstName, 80);
  const lastName = text(body.lastName, 80);
  const email = text(body.email, 160).toLowerCase();
  const phone = text(body.phone, 40);
  const nationalId = text(body.nationalId, 40);
  const reason = text(body.reason, 40);
  const additionalInfo = text(body.additionalInfo, 2000);

  if (!firstName || !lastName || !phone || !nationalId || !isEmail(email)) {
    throw badRequest('Completa los campos obligatorios.');
  }
  if (!REASONS.includes(reason as Reason)) {
    throw badRequest('Elige un motivo de la lista.');
  }
  if (body.confirmed !== true) {
    throw badRequest('Confirma que entiendes las consecuencias de la baja.');
  }

  const chosen = reason as Reason;
  await ServiceCancellation.create({
    firstName,
    lastName,
    email,
    phone,
    nationalId,
    reason: chosen,
    additionalInfo: additionalInfo || undefined,
    confirmed: true,
  });

  const admins = await User.find({ role: 'admin', enabled: { $ne: false } }).select('email');
  await Promise.all(
    admins.map((admin) =>
      EmailService.sendServiceCancellation(admin.email, {
        firstName,
        lastName,
        email,
        phone,
        nationalId,
        reason: REASON_LABEL[chosen],
        additionalInfo,
      }),
    ),
  );

  return res.status(201).json({ success: true });
}
