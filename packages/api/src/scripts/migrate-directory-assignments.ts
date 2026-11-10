/**
 * Materializa qué proveedores y empleados ve cada obra.
 *
 * Antes, toda la libreta de la Empresa aparecía en todas sus obras. Ahora una
 * obra sólo ve lo que tiene asignado (`ProjectProvider` / `ProjectCrewMember`).
 * Sin esta migración, las obras existentes perderían de vista a todos los que ya
 * usan.
 *
 * Se asigna a cada obra lo que ya tiene en uso, y nada más:
 *
 * - Proveedores: los de sus actividades (`ActivityProvider`), sus contrataciones
 *   (`ProviderEngagement`) y sus gastos (`Expense`).
 * - Empleados: los de sus actividades (`ActivityCrew`), su asistencia
 *   (`LaborRecord`) y sus metas (`CrewGoal`).
 *
 * Quien no está en uso en ninguna obra queda en la libreta, sin asignar: se suma
 * a la obra que corresponda desde la pantalla.
 *
 * Idempotente. No borra nada. `--dry-run` informa sin escribir.
 *
 *   pnpm --filter @luma/api migrate:directory
 *
 * En producción, compilado:
 *   docker exec -w /app/packages/api <container> \
 *     node dist/scripts/migrate-directory-assignments.js
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { Activity } from '../models/Activity.js';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { ActivityProvider } from '../models/ActivityProvider.js';
import { CrewGoal } from '../models/CrewGoal.js';
import { CrewMember } from '../models/CrewMember.js';
import { Expense } from '../models/Expense.js';
import { LaborRecord } from '../models/LaborRecord.js';
import { Project } from '../models/Project.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';
import { ProjectProvider } from '../models/ProjectProvider.js';
import { Provider } from '../models/Provider.js';
import { ProviderEngagement } from '../models/ProviderEngagement.js';

const dryRun = process.argv.includes('--dry-run');

function unique(ids: unknown[]): string[] {
  return [...new Set(ids.filter(Boolean).map(String))];
}

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const projects = await Project.find().select('organization name');
  let providerLinks = 0;
  let crewLinks = 0;

  for (const project of projects) {
    const activityIds = await Activity.find({ project: project._id }).distinct('_id');

    const providerIds = unique([
      ...(await ActivityProvider.find({ activity: { $in: activityIds } }).distinct('provider')),
      ...(await ProviderEngagement.find({ project: project._id }).distinct('provider')),
      ...(await Expense.find({ project: project._id, provider: { $ne: null } }).distinct('provider')),
    ]);
    const crewIds = unique([
      ...(await ActivityCrew.find({ activity: { $in: activityIds } }).distinct('crewMember')),
      ...(await LaborRecord.find({ project: project._id }).distinct('presentCrewMembers')),
      ...(await CrewGoal.find({ project: project._id }).distinct('crewMember')),
    ]);

    // Sólo de la libreta de la MISMA Empresa y sin los privados de otra obra.
    const providers = await Provider.find({
      _id: { $in: providerIds },
      organization: project.organization,
      scope: { $ne: 'project' },
    }).select('_id');
    const crew = await CrewMember.find({
      _id: { $in: crewIds },
      organization: project.organization,
      scope: { $ne: 'project' },
    }).select('_id');

    console.log(`📋 ${project.name}: ${providers.length} proveedor(es), ${crew.length} empleado(s).`);
    providerLinks += providers.length;
    crewLinks += crew.length;

    if (dryRun) continue;

    for (const provider of providers) {
      await ProjectProvider.updateOne(
        { project: project._id, provider: provider._id },
        { $setOnInsert: { project: project._id, provider: provider._id } },
        { upsert: true },
      );
    }
    for (const member of crew) {
      await ProjectCrewMember.updateOne(
        { project: project._id, crewMember: member._id },
        { $setOnInsert: { project: project._id, crewMember: member._id } },
        { upsert: true },
      );
    }
  }

  console.log(
    `\n${dryRun ? '🔍 --dry-run: se habrían asignado' : '✅ Asignados'} hasta ${providerLinks} proveedor(es) y ${crewLinks} empleado(s) a sus obras.`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ Migración fallida:', error);
  await mongoose.disconnect();
  process.exit(1);
});
