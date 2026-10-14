/**
 * Pone al día el personal de obra y las tareas. Tres pasos:
 *
 * 1. **Metas → tareas**: las "metas semanales" eran una entidad aparte de las
 *    actividades. Ahora una tarea ES una actividad, así que cada meta se
 *    convierte en una: dura su semana, la persona queda de responsable y en
 *    la cuadrilla, y el estado se traduce (ver `lib/goal-to-task.ts`). La meta
 *    no se borra: queda marcada con `migratedToActivity`, que es lo que hace
 *    al paso idempotente y lo que permite rastrear de dónde salió cada tarea.
 * 2. **"Sólo para esta obra" → Empresa**: ese alcance ya no existe. Un obrero
 *    tiene que poder sumarse a otra obra sin recrearlo, así que pasa a la
 *    libreta de la Empresa y queda asignado a la obra donde estaba.
 * 3. **Reporte de posibles duplicados** (mismo tipo y mismo nombre o
 *    teléfono). Sólo los LISTA: fusionar mueve asistencia y cuadrillas de un
 *    registro a otro, y eso lo decide una persona mirando el reporte.
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
import { normalizePersonName, normalizePhone } from '@luma/shared';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { Activity } from '../models/Activity.js';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { CrewGoal } from '../models/CrewGoal.js';
import { CrewMember, type ICrewMember } from '../models/CrewMember.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';
import { goalToTask } from './lib/goal-to-task.js';

const apply = process.argv.includes('--apply');

async function migrateGoalsToTasks(): Promise<void> {
  console.log('\n— Metas → tareas —');
  const goals = await CrewGoal.find({ migratedToActivity: null });
  console.log(`  ${goals.length} meta(s) a convertir en tarea.`);

  for (const goal of goals) {
    const owner = await CrewMember.findById(goal.crewMember).select('name specialty');
    const linked = goal.activity
      ? await Activity.findById(goal.activity).select('name specialty')
      : null;
    const task = goalToTask(goal, owner, linked);
    console.log(`  · «${task.name}» (${task.startDate} → ${task.endDate}, ${task.status})`);

    if (!apply) continue;

    const activity = await Activity.create(task);
    if (owner) {
      await ActivityCrew.updateOne(
        { activity: activity._id, crewMember: owner._id },
        { $setOnInsert: { activity: activity._id, crewMember: owner._id } },
        { upsert: true },
      );
    }
    await CrewGoal.updateOne({ _id: goal._id }, { $set: { migratedToActivity: activity._id } });
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

  await migrateGoalsToTasks();
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
