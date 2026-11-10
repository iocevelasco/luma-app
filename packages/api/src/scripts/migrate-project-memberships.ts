/**
 * Migra el acceso a obras de la v1 al modelo de `ProjectMembership`.
 *
 * No crea ningún `contador`: ese rol es nuevo y no existía nada equivalente
 * que migrar. Se invita a mano desde la pantalla de equipo de cada obra.
 *
 * Dos orígenes, dos destinos:
 *
 * 1. Cada fila de `ProjectClient` pasa a ser una membresía `role: 'cliente'`.
 *    Es un renombre: misma persona, misma obra, mismo acceso.
 *
 * 2. Cada Asistente de Obra (`OrganizationMember` con `role: 'member'`) pasa a
 *    ser una membresía `role: 'supervisor'` **en cada obra de su Empresa**.
 *    Esto no es un renombre y conviene entenderlo: el Asistente tenía acceso
 *    org-wide, así que para no sacarle nada hay que materializar una fila por
 *    obra. De acá en adelante el acceso deja de propagarse solo — un supervisor
 *    no entra a las obras nuevas de la Empresa hasta que lo inviten. Ese es
 *    justamente el cambio que la matriz de roles pide.
 *
 * Y una advertencia que el script no puede resolver solo: el supervisor pierde
 * permisos que el Asistente tenía (crear actividades, administrar el roster).
 * No es un bug de la migración, es la grilla nueva.
 *
 * Idempotente: se puede correr dos veces sin duplicar nada. No borra ninguna
 * fila vieja — `ProjectClient` queda intacta para poder volver atrás.
 *
 *   pnpm --filter @luma/api exec tsx src/scripts/migrate-project-memberships.ts
 *
 * En producción la imagen no tiene `src/` ni `tsx`, así que se corre compilado:
 *   docker exec -w /app/packages/api <container> \
 *     node dist/scripts/migrate-project-memberships.js
 *
 * `--dry-run` informa sin escribir.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { Project } from '../models/Project.js';
import { ProjectClient } from '../models/ProjectClient.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import type { InvitableProjectRole } from '@luma/shared';

const dryRun = process.argv.includes('--dry-run');

interface PendingMembership {
  project: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  role: InvitableProjectRole;
  invitedBy: mongoose.Types.ObjectId;
}

async function main() {
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const pending: PendingMembership[] = [];

  // --- 1. Clientes invitados -------------------------------------------------
  const clientRows = await ProjectClient.find().select('project user invitedBy');
  for (const row of clientRows) {
    pending.push({
      project: row.project,
      user: row.user,
      role: 'cliente',
      invitedBy: row.invitedBy,
    });
  }
  console.log(`📋 ${clientRows.length} cliente(s) en ProjectClient.`);

  // --- 2. Asistentes de Obra, una fila por obra de su Empresa ---------------
  const assistants = await OrganizationMember.find({ role: 'member' }).select('organization user');
  let assistantRows = 0;

  for (const assistant of assistants) {
    const projects = await Project.find({ organization: assistant.organization }).select(
      'createdBy',
    );

    for (const project of projects) {
      // El gerente no lleva membresía. Si el Asistente creó esa obra, ya es su
      // gerente y una fila de supervisor sólo lo degradaría.
      if (String(project.createdBy) === String(assistant.user)) continue;

      pending.push({
        project: project._id as mongoose.Types.ObjectId,
        user: assistant.user,
        role: 'supervisor',
        // Quien creó la obra es quien de hecho le dio acceso.
        invitedBy: project.createdBy,
      });
      assistantRows += 1;
    }
  }
  console.log(
    `📋 ${assistants.length} Asistente(s) de Obra → ${assistantRows} membresía(s) de supervisor.`,
  );

  // --- 3. Escritura ----------------------------------------------------------
  if (dryRun) {
    console.log(`\n🔍 --dry-run: se habrían creado hasta ${pending.length} membresía(s).`);
    await mongoose.disconnect();
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const row of pending) {
    // `updateOne` con `upsert` y `$setOnInsert`: si la fila ya existe —porque
    // el script ya corrió, o porque alguien fue invitado a mano— no le pisa el
    // rol. Un `insertMany` acá degradaría a cliente a quien ya es supervisor.
    const result = await ProjectMembership.updateOne(
      { project: row.project, user: row.user },
      { $setOnInsert: row },
      { upsert: true },
    );

    if (result.upsertedCount > 0) created += 1;
    else skipped += 1;
  }

  console.log(`\n✅ ${created} membresía(s) creada(s), ${skipped} ya existente(s).`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ Migración fallida:', error);
  await mongoose.disconnect();
  process.exit(1);
});
