import { ACCOUNT_PURGE_RETENTION_DAYS } from '@luma/shared';
import { User } from '../models/User.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface AccountPurgeRun {
  checked: number;
  purged: number;
  failed: number;
}

/**
 * Borra los datos personales de las cuentas dadas de baja hace más de
 * `ACCOUNT_PURGE_RETENTION_DAYS` días.
 *
 * El documento NO se borra: lo referencian las obras, cobros y gastos que esa
 * persona registró, y quitarlo dejaría esos registros huérfanos. Lo que se
 * borra es todo lo que la identifica — email, nombre, foto, contraseña,
 * tokens, y la IP y el user agent de la aceptación de los Términos. El email
 * queda reemplazado por uno único e inválido, porque el campo es `unique`.
 *
 * Idempotente: una cuenta ya purgada (`purgedAt`) no se vuelve a tocar.
 */
export async function purgeExpiredAccounts(now = new Date()): Promise<AccountPurgeRun> {
  const cutoff = new Date(now.getTime() - ACCOUNT_PURGE_RETENTION_DAYS * DAY_MS);
  const expired = await User.find({
    account_status: 'inactive',
    deactivated_at: { $lte: cutoff },
    purgedAt: { $exists: false },
  }).select('_id');

  const run: AccountPurgeRun = { checked: expired.length, purged: 0, failed: 0 };

  for (const { _id } of expired) {
    try {
      await User.updateOne(
        { _id },
        {
          $set: {
            email: `purged-${String(_id)}@purged.invalid`,
            name: 'Cuenta eliminada',
            email_verified: false,
            enabled: false,
            purgedAt: now,
          },
          $unset: {
            picture: '',
            password: '',
            resetToken: '',
            resetTokenExpires: '',
            emailVerificationToken: '',
            emailVerificationTokenExpires: '',
            pendingEmail: '',
            emailChangeToken: '',
            emailChangeTokenExpires: '',
            termsAcceptedIp: '',
            termsAcceptedUserAgent: '',
          },
        },
      );
      run.purged += 1;
    } catch (error) {
      run.failed += 1;
      console.error(`❌ [ACCOUNT-PURGE] ${String(_id)}:`, error);
    }
  }

  return run;
}
