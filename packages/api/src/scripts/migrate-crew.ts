/**
 * Pone al día el personal de obra y sus metas. Tres pasos:
 *
 * 1. **Estados de meta a inglés**: `pendiente` → `pending`, `cumplida` →
 *    `done`, `no_cumplida` → `discarded`. Mientras no corra, la API los
 *    traduce al leer; después de correrla, ese shim se borra.
 * 2. **"Sólo para esta obra" → Empresa**: ese alcance ya no existe. Un obrero
 *    tiene que poder sumarse a otra obra sin recrearlo, así que pasa a la
 *    libreta de la Empresa y queda asignado a la obra donde estaba.
 * 3. **Reporte de posibles duplicados** (mismo tipo y mismo nombre o
 *    teléfono). Sólo los LISTA: fusionar mueve asistencia, metas y cuadrillas
 *    de un registro a otro, y eso lo decide una persona mirando el reporte.
 *
 * Idempotente. **En seco por default**: informa sin escribir. `--apply`
 * escribe. El paso 2 puede generar duplicados nuevos (el privado de una obra
 * con su homónimo de la Empresa); por eso el reporte va al final.
 *
 *   pnpm --filter @luma/api migrate:crew            # en seco
 *   pnpm --filter @luma/api migrate:crew --apply
 *
 * En producción, compilado:
 *   docker exec -w /app/packages/api <container> \
 *     node dist/scripts/migrate-crew.js --apply
 */
import mongoose from 'mongoose';
import { LEGACY_CREW_GOAL_STATUS, normalizePersonName, normalizePhone } from '@luma/shared';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { CrewGoal } from '../models/CrewGoal.js';
import { CrewMember, type ICrewMember } from '../models/CrewMember.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';

const apply = process.argv.includes('--apply');

async function migrateGoalStatuses(): Promise<void> {
  console.log('\n— Estados de meta —');
  for (const [legacy, current] of Object.entries(LEGACY_CREW_GOAL_STATUS)) {
    const count = await CrewGoal.countDocuments({ status: legacy });
    console.log(`  ${legacy} → ${current}: ${count}`);
    if (apply && count > 0) {
      await CrewGoal.updateMany({ status: legacy }, { $set: { status: current } });
    }
  }
}

async function promoteProjectScopedCrew(): Promise<void> {
  console.log('\n— "Sólo para esta obra" → Empresa —');
  const privates = await CrewMember.find({ scope: 'project' }).select('name project');
  console.log(`  ${privates.length} empleado(s) a pasar a la libreta de la Empresa.`);
  if (!apply) return;

  for (const member of privates) {
    if (member.project) {
      await ProjectCrewMember.updateOne(
        { project: member.project, crewMember: member._id },
        { $setOnInsert: { project: member.project, crewMember: member._id } },
        { upsert: true },
      );
    }
    await CrewMember.updateOne(
      { _id: member._id },
      { $set: { scope: 'organization', project: null } },
    );
  }
}

function describe(member: ICrewMember): string {
  return `${member.name} (${String(member._id)}${member.active ? '' : ', dado de baja'})`;
}

/** Agrupa por una clave y devuelve los grupos con más de uno. */
function groupsOf(members: ICrewMember[], key: (member: ICrewMember) => string | undefined) {
  const groups = new Map<string, ICrewMember[]>();
  for (const member of members) {
    const value = key(member);
    if (!value) continue;
    groups.set(value, [...(groups.get(value) ?? []), member]);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

async function reportDuplicates(): Promise<void> {
  console.log('\n— Posibles duplicados (no se toca nada) —');
  const members = await CrewMember.find().select('organization name phone kind active');

  const byOrganizationAndKind = (member: ICrewMember) =>
    `${String(member.organization)}|${member.kind ?? 'persona'}`;

  const byName = groupsOf(
    members,
    (member) => `${byOrganizationAndKind(member)}|${normalizePersonName(member.name)}`,
  );
  const byPhone = groupsOf(members, (member) => {
    const phone = normalizePhone(member.phone);
    return phone ? `${byOrganizationAndKind(member)}|${phone}` : undefined;
  });

  for (const group of byPhone) console.log(`  Mismo teléfono: ${group.map(describe).join(' · ')}`);
  for (const group of byName) console.log(`  Mismo nombre:   ${group.map(describe).join(' · ')}`);
  if (byName.length === 0 && byPhone.length === 0) console.log('  Ninguno.');
}

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  console.log(apply ? '✍️  --apply: escribiendo.' : '🔍 En seco: no se escribe nada (usá --apply).');

  await migrateGoalStatuses();
  await promoteProjectScopedCrew();
  await reportDuplicates();

  console.log(apply ? '\n✅ Listo.' : '\n🔍 Fin de la corrida en seco.');
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ Migración fallida:', error);
  await mongoose.disconnect();
  process.exit(1);
});
