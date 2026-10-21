/**
 * Pone a las Empresas que ya existían en el sistema de suscripción.
 *
 * Regla acordada para el lanzamiento: **toda Empresa que ya tiene obras
 * arranca su mes gratis el día que corre esta migración**. Las que no tienen
 * obras no reciben nada: quedan `sin_iniciar`, y su prueba arranca cuando
 * creen la primera (mismo camino que un invitado).
 *
 * Además completa `archivedAt` de las obras que ya estaban archivadas, con
 * su `updatedAt` como mejor aproximación: antes no se guardaba cuándo.
 *
 * Idempotente: una Empresa que ya tiene suscripción no se toca —la prueba no
 * se reinicia nunca— y una obra que ya tiene `archivedAt` tampoco.
 *
 *   pnpm --filter @luma/api migrate:subscriptions --dry-run
 *   pnpm --filter @luma/api migrate:subscriptions
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Project } from '../models/Project.js';
import { Subscription } from '../models/Subscription.js';
import { startTrialFor } from '../services/subscription.service.js';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  const now = new Date();

  const organizationIds = (await Project.distinct('organization')).map(String);
  const alreadySubscribed = new Set(
    (await Subscription.find({ organization: { $in: organizationIds } }).distinct('organization')).map(
      String,
    ),
  );

  let started = 0;
  let withoutOwner = 0;
  for (const organizationId of organizationIds) {
    if (alreadySubscribed.has(organizationId)) continue;

    const owner = await OrganizationMember.findOne({
      organization: organizationId,
      role: 'owner',
    }).select('user');
    if (!owner) {
      withoutOwner += 1;
      console.warn(`⚠️  Empresa ${organizationId} sin dueño: no se le puede arrancar la prueba.`);
      continue;
    }

    if (!dryRun) await startTrialFor(organizationId, owner.user, now);
    started += 1;
  }

  const archivedWithoutDate = await Project.find({
    status: 'archived',
    $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
  }).select('_id updatedAt');

  if (!dryRun) {
    for (const project of archivedWithoutDate) {
      // updateOne y no findOneAndUpdate: el hook de Project pisaría la fecha con "ahora".
      await Project.updateOne({ _id: project._id }, { $set: { archivedAt: project.updatedAt } });
    }
  }

  console.log(dryRun ? '🔎 Dry run — no se escribió nada.' : '✅ Migración aplicada.');
  console.log(`   Empresas con obras: ${organizationIds.length}`);
  console.log(`   Ya tenían suscripción: ${alreadySubscribed.size}`);
  console.log(`   Prueba arrancada hoy: ${started}`);
  if (withoutOwner) console.log(`   Sin dueño (revisar a mano): ${withoutOwner}`);
  console.log(`   Obras archivadas a las que se les completó archivedAt: ${archivedWithoutDate.length}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ migrate-subscriptions:', error);
  await mongoose.disconnect();
  process.exit(1);
});
