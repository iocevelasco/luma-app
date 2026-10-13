import type { ActivationDelivery } from '@luma/shared';
import { appUrl } from './app-url.js';

/** El enlace de activación: el mismo que va en el mail y el que se entrega si el mail no salió. */
export function activationUrl(token: string): string {
  return appUrl(`/activate?token=${token}`);
}

/**
 * Qué se le cuenta a quien invitó sobre el mail de activación.
 *
 * El enlace sólo se entrega cuando el mail NO salió. Quien tiene el enlace
 * puede elegir la contraseña de esa cuenta, así que no se reparte de más: es
 * el último recurso para que la persona no quede afuera, no una función de
 * "ver el link" de toda invitación.
 */
export function activationDelivery(emailSent: boolean, token: string): ActivationDelivery {
  return emailSent ? { emailSent: true } : { emailSent: false, activationUrl: activationUrl(token) };
}
