import mongoose from 'mongoose';
import { DATABASE_CONFIG, isProduction } from './app.config.js';

const MONGODB_URI = DATABASE_CONFIG.MONGODB_URI;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000;

let isConnected = false;
let attempts = 0;

function maskUri(uri: string): string {
  return uri.includes('@') ? uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@') : uri;
}

/**
 * Conecta a MongoDB con reintentos.
 *
 * Devuelve un booleano en lugar de tirar: el servidor levanta igual sin base,
 * para que el health check responda y la plataforma (Fly.io) no mate la
 * máquina mientras Atlas todavía no aceptó la IP.
 */
export async function connectDatabase(retry = true): Promise<boolean> {
  if (isConnected && mongoose.connection.readyState === 1) return true;

  try {
    attempts++;
    console.log(`🔄 [DB] Conectando a MongoDB (intento ${attempts}/${MAX_RETRIES})…`);
    console.log(`📝 [DB] URI: ${maskUri(MONGODB_URI)}`);

    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

    isConnected = true;
    attempts = 0;
    console.log(`✅ [DB] Conectado — base: ${mongoose.connection.db?.databaseName ?? '?'}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ [DB] Error de conexión (${attempts}/${MAX_RETRIES}): ${message}`);

    if (message.includes('IP') && message.includes('whitelist')) {
      console.error('💡 [DB] Agregá la IP del servidor en MongoDB Atlas → Network Access.');
    }

    if (retry && attempts < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
      return connectDatabase(true);
    }

    isConnected = false;
    return false;
  }
}

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  console.warn('⚠️  [DB] Desconectado de MongoDB');
  if (isProduction) setTimeout(() => connectDatabase(true), RETRY_DELAY);
});

mongoose.connection.on('error', (error) => {
  isConnected = false;
  console.error('❌ [DB] Error de conexión:', error.message);
});

export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
