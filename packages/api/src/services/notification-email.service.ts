import type mongoose from 'mongoose';
import type { NotificationType, ProjectRole } from '@luma/shared';
import { User } from '../models/User.js';
import { EmailService, type ProjectNotificationEmailType } from './email.service.js';

/**
 * Qué avisos de obra llegan además por mail, y a quién.
 *
 * Sólo los que piden que alguien haga algo o que el cliente se entere sin
 * entrar a la app. El resto (actividad iniciada o cumplida) queda en la
 * campanita: un mail por cada cambio de estado enseña a mandarlos a spam.
 *
 * La audiencia del mail es más chica que la del aviso: un hito lo ven en la
 * app gerente, supervisor y cliente, pero el mail es para el cliente, que es
 * quien no está todos los días en la obra.
 */
export const EMAIL_AUDIENCE: Partial<Record<NotificationType, readonly ProjectRole[]>> = {
  actividad_en_revision: ['gerente'],
  eventualidad: ['gerente'],
  hito: ['cliente'],
};

/**
 * Manda los mails de un aviso. Nunca lanza ni se espera desde la acción: se
 * llama con `void`, así cerrar una actividad no tarda lo que tarda Resend.
 */
export async function emailProjectNotification(params: {
  recipientIds: readonly (mongoose.Types.ObjectId | string)[];
  type: NotificationType;
  projectName: string;
  subjectName: string;
  link: string;
}): Promise<number> {
  try {
    if (!EMAIL_AUDIENCE[params.type] || params.recipientIds.length === 0) return 0;

    // Sólo cuentas que pueden entrar: una invitación sin activar todavía no
    // tiene a dónde llevar el enlace, y una cuenta desactivada no se avisa.
    const users = await User.find({
      _id: { $in: params.recipientIds },
      email_verified: true,
      enabled: { $ne: false },
    }).select('email name');

    const results = await Promise.all(
      users.map((user) =>
        EmailService.sendProjectNotification({
          to: user.email,
          name: user.name,
          type: params.type as ProjectNotificationEmailType,
          projectName: params.projectName,
          subjectName: params.subjectName,
          link: params.link,
        }),
      ),
    );
    return results.filter(Boolean).length;
  } catch (error) {
    console.error('❌ [NOTIFICATION] emailProjectNotification:', error);
    return 0;
  }
}
