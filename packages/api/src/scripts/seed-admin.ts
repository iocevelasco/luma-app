/**
 * Crea (o actualiza) el primer usuario admin.
 *
 * En producción la imagen no tiene `src/` ni `tsx`, así que se corre compilado:
 *   docker exec --env-file /tmp/admin.env -w /app/packages/api <container> \
 *     node dist/scripts/seed-admin.js
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { User } from '../models/User.js';

const BCRYPT_ROUNDS = 10;

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Admin';

  if (!email || !password) {
    console.error('❌ Faltan ADMIN_EMAIL y/o ADMIN_PASSWORD.');
    process.exit(1);
  }

  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const existing = await User.findOne({ email });

  if (existing) {
    existing.password = hashed;
    existing.role = 'admin';
    existing.email_verified = true;
    existing.enabled = true;
    existing.account_status = 'active';
    await existing.save();
    console.log(`✅ Admin actualizado: ${email}`);
  } else {
    await User.create({
      email,
      name,
      password: hashed,
      role: 'admin',
      email_verified: true,
      enabled: true,
      account_status: 'active',
    });
    console.log(`✅ Admin creado: ${email}`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ seed-admin falló:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
