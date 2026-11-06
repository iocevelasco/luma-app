/**
 * Registra en el inventario la entrada de los materiales que ya estaban «En
 * obra» antes de que existiera el kardex. Se corre una vez al desplegar el
 * inventario:
 *
 *   node dist/scripts/backfill-stock-entries.js
 *
 * Correrlo más de una vez es inofensivo: cada material tiene una sola entrada
 * (índice único), y los que ya la tienen se saltean.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { backfillPurchaseEntries } from '../services/inventory.service.js';

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const run = await backfillPurchaseEntries();
  console.log(`📦 Revisados ${run.materials} materiales en obra · ${run.created} entradas nuevas`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ backfill-stock-entries:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
