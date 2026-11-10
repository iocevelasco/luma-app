/**
 * Borra los datos personales de las cuentas dadas de baja hace más de 90 días.
 * Lo corre una tarea programada de Coolify una vez por día:
 *
 *   node dist/scripts/purge-deactivated-accounts.js
 *
 * Correrlo más de una vez es inofensivo: una cuenta ya purgada no se toca.
 * Sale con código 1 si alguna falló, para que se vea en el historial de la
 * tarea; esa cuenta se reintenta al otro día.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { purgeExpiredAccounts } from '../services/account-purge.service.js';

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const run = await purgeExpiredAccounts();
  console.log(
    `🗑️  Revisadas ${run.checked} cuentas vencidas · ${run.purged} purgadas · ${run.failed} con falla`,
  );
  await mongoose.disconnect();
  if (run.failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error('❌ purge-deactivated-accounts:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
