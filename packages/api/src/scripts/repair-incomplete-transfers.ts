/**
 * Revierte los traspasos del Depósito General que quedaron a medias por un corte
 * entre sus dos escrituras (ver `repairIncompleteTransfers`). Lo corre una tarea
 * programada de Coolify una vez por día:
 *
 *   node dist/scripts/repair-incomplete-transfers.js
 *
 * Correrlo más de una vez es inofensivo: un traspaso completo no se toca, y sólo
 * mira los de hace entre 10 minutos y 3 días.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { repairIncompleteTransfers } from '../services/deposit.service.js';

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const run = await repairIncompleteTransfers();
  console.log(`🔧 Revisados ${run.checked} traspasos · ${run.repaired} revertidos por estar a medias`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ repair-incomplete-transfers:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
