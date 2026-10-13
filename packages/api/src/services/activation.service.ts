import { User } from '../models/User.js';

/**
 * Mensaje cuando otra persona tiene (o usó) el enlace de activación de la
 * cuenta. No dice quién ni por qué más de lo necesario: esto lo ve cualquiera
 * que invite, no sólo quien tuvo el enlace.
 */
export const LINK_HELD_BY_ANOTHER_MESSAGE =
  'No pudimos sumar a esa persona todavía: su cuenta necesita confirmar el correo. ' +
  'Pedile que use «Olvidé mi contraseña» y volvé a intentarlo.';

/**
 * Deja asentado qué pasó con el enlace de activación de una cuenta que acaba
 * de recibir un token nuevo.
 *
 * Si el mail NO salió, el enlace queda en manos de quien invitó
 * (`activationLinkHeldBy`). Si salió, el token nuevo sólo existe en la casilla
 * y cualquier marca anterior deja de valer: el enlace viejo ya no funciona.
 */
export async function recordActivationDelivery(
  userId: unknown,
  emailSent: boolean,
  inviterId: string,
): Promise<void> {
  await User.updateOne(
    { _id: userId },
    emailSent
      ? { $unset: { activationLinkHeldBy: '' } }
      : { $set: { activationLinkHeldBy: inviterId } },
  );
}

/**
 * ¿Esta cuenta está atada a un enlace que tiene o tuvo otra persona?
 *
 * Quien invitó y se llevó el enlace en pantalla puede activar la cuenta, y
 * con la contraseña que elija entra como esa persona. Si OTRA Empresa la suma
 * a una obra mientras tanto, esa persona hereda el acceso. Por eso sólo quien
 * tiene el enlace puede seguir invitando a esa cuenta hasta que la persona
 * real confirme su correo.
 */
export function isLinkedToAnotherInviter(
  user: { activationLinkHeldBy?: unknown; claimedViaLinkBy?: unknown },
  inviterId: string,
): boolean {
  const holder = user.activationLinkHeldBy ?? user.claimedViaLinkBy;
  return Boolean(holder) && String(holder) !== inviterId;
}
