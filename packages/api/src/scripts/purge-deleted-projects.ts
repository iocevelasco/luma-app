/**
 * Borra de verdad las obras cuya papelera venció (90 días después de
 * eliminarlas), con todo lo que tenían y sus archivos. Lo corre una tarea
 * programada de Coolify una vez por día:
 *
 *   node dist/scripts/purge-deleted-projects.js
 *
 * Correrlo más de una vez es inofensivo: sólo toca obras con `purgeAt` ya
 * vencido. Sale con código 1 si alguna falló, para que se vea en el historial
 * de la tarea; esa obra sigue en la papelera y se reintenta al otro día.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { purgeExpiredProjects } from '../services/project-deletion.service.js';

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const run = await purgeExpiredProjects();
  console.log(
    `🗑️  Revisadas ${run.checked} obras vencidas · ${run.purged} borradas · ${run.failed} con falla`,
  );
  await mongoose.disconnect();
  if (run.failed > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error('❌ purge-deleted-projects:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
