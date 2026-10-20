/**
 * Manda los recordatorios de la suscripción que tocan hoy: fin del plan
 * Gratis (a 7, 3 y 1 día) y suscripción vencida. Lo corre una tarea
 * programada de Coolify una vez por día:
 *
 *   node dist/scripts/send-subscription-reminders.js
 *
 * Correrlo más de una vez no duplica mails: cada aviso se marca en la
 * suscripción cuando sale. Sale con código 1 si alguno falló, para que se
 * vea en el historial de la tarea.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { sendDueReminders } from '../services/subscription-notify.service.js';

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const run = await sendDueReminders();
  console.log(
    `📬 Revisadas ${run.checked} suscripciones · ${run.sent} recordatorio(s) enviados · ${run.failed} con falla`,
  );
  await mongoose.disconnect();
  if (run.failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error('❌ send-subscription-reminders:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
