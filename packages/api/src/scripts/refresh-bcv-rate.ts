/**
 * Lee la tasa del BCV y la guarda. Lo corre una tarea programada de Coolify:
 *
 *   node dist/scripts/refresh-bcv-rate.js
 *
 * Sale con código 1 si no pudo leer, para que Coolify lo marque como fallido
 * y se vea en su historial. Una corrida fallida no rompe nada: la última tasa
 * buena sigue vigente hasta `BCV_CONFIG.MAX_AGE_HOURS`.
 *
 * Frecuencia sugerida: cada hora entre las 8 y las 20 de Caracas. El BCV
 * publica a la tarde, y leerlo de más no cuesta: si la tasa no cambió, sólo
 * se confirma la que ya está.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { refreshBcvRate } from '../services/bcv.service.js';

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const outcome = await refreshBcvRate();
  const { usd, valueDate } = outcome.rate;
  const line = `${usd} Bs/USD · fecha valor ${valueDate}`;

  if (outcome.status === 'marcada') {
    // Salida 1 también: alguien tiene que mirarla antes de que se use.
    console.error(`⚠️  Tasa marcada para revisión, no se usa: ${line} — ${outcome.rate.flagReason}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`${outcome.status === 'nueva' ? '🆕 Nueva' : '✅ Confirmada'}: ${line}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ refresh-bcv-rate:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
