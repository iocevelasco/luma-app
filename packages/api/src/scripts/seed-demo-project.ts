/**
 * Proyecto de demostración.
 *
 * Sirve para recorrer el MVP entero sin cargar nada a mano: los datos siguen
 * el caso real que menciona el documento (§RF-07: "hacen falta 3 sacos más de
 * arena y son $100.000 más por falta de hierro").
 *
 *   pnpm --filter @luma/api seed:demo
 */
import mongoose from 'mongoose';
import { isoWeekKey, toDateKey } from '@luma/shared';
import { connectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.js';
import { ProjectModel } from '../models/Project.js';
import { ProjectMemberModel } from '../models/ProjectMember.js';
import { ActivityModel } from '../models/Activity.js';
import { MaterialModel } from '../models/Material.js';
import { WorkerModel } from '../models/Worker.js';
import { AttendanceModel } from '../models/Attendance.js';
import { BudgetModel } from '../models/Budget.js';
import { ContingencyModel } from '../models/Contingency.js';
import { AuthService } from '../services/auth.service.js';

const DEMO_PASSWORD = 'luma1234';

async function main() {
  const ok = await connectDatabase(false);
  if (!ok) throw new Error('No hay conexión a MongoDB');

  const password = await AuthService.hashPassword(DEMO_PASSWORD);

  const people = [
    { email: 'ejecutante@luma.demo', name: 'Ioce Velasco', role: 'executor' as const },
    { email: 'encargado@luma.demo', name: 'Arq. Marina Ruiz', role: 'manager' as const },
    { email: 'asistente@luma.demo', name: 'Diego Paz', role: 'assistant' as const },
    { email: 'cliente@luma.demo', name: 'Laura Fernández', role: 'client' as const },
  ];

  const users = [];
  for (const person of people) {
    const user = await UserModel.findOneAndUpdate(
      { email: person.email },
      { email: person.email, name: person.name, password, email_verified: true, enabled: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    users.push({ ...person, id: user._id });
  }

  const owner = users[0];
  await ProjectModel.deleteMany({ name: 'Remodelación Depto Belgrano' });
  const project = await ProjectModel.create({
    name: 'Remodelación Depto Belgrano',
    description: 'Baño principal, cocina y placard a medida.',
    address: 'Av. Cabildo 2200, CABA',
    status: 'active',
    currency: 'ARS',
    start_date: new Date(Date.now() - 21 * 86400000),
    planned_end_date: new Date(Date.now() + 35 * 86400000),
    owner_id: owner.id,
    margin_pct: 12,
  });

  await ProjectMemberModel.deleteMany({ project_id: project._id });
  await ProjectMemberModel.insertMany(
    users.map((u) => ({
      project_id: project._id,
      user_id: u.id,
      role: u.role,
      status: 'active',
      joined_at: new Date(),
    })),
  );

  const chapters = [
    {
      code: 'demolicion',
      name: 'Demolición y retiro',
      items: [
        { name: 'Demolición de revestimientos', unit: 'm2', quantity: 34, unit_price: 12000, total: 408000 },
        { name: 'Retiro de escombros', unit: 'global', quantity: 1, unit_price: 180000, total: 180000 },
      ],
      total: 588000,
    },
    {
      code: 'albanileria',
      name: 'Albañilería',
      items: [
        { name: 'Contrapiso y carpeta', unit: 'm2', quantity: 34, unit_price: 26000, total: 884000 },
        { name: 'Tabiques de ladrillo', unit: 'm2', quantity: 12, unit_price: 41000, total: 492000 },
      ],
      total: 1376000,
    },
    {
      code: 'instalaciones',
      name: 'Instalaciones',
      items: [
        { name: 'Instalación sanitaria', unit: 'global', quantity: 1, unit_price: 1250000, total: 1250000 },
        { name: 'Instalación eléctrica', unit: 'global', quantity: 1, unit_price: 980000, total: 980000 },
      ],
      total: 2230000,
    },
    {
      code: 'terminaciones',
      name: 'Terminaciones',
      items: [
        { name: 'Colocación de porcelanato', unit: 'm2', quantity: 34, unit_price: 34000, total: 1156000 },
        { name: 'Placard a medida', unit: 'un', quantity: 1, unit_price: 1450000, total: 1450000 },
        { name: 'Pintura general', unit: 'm2', quantity: 96, unit_price: 8500, total: 816000 },
      ],
      total: 3422000,
    },
  ];

  await BudgetModel.deleteMany({ project_id: project._id });
  const budget = await BudgetModel.create({
    project_id: project._id,
    version: 1,
    is_baseline: true,
    source: 'import',
    file_name: 'presupuesto-belgrano.xlsx',
    currency: 'ARS',
    chapters,
    total: chapters.reduce((s, c) => s + c.total, 0),
    imported_by: owner.id,
  });
  await ProjectModel.updateOne({ _id: project._id }, { budget_id: budget._id });

  const day = (offset: number) => new Date(Date.now() + offset * 86400000);
  const activityData = [
    { name: 'Demolición baño principal', area: 'Baño', chapter_code: 'demolicion', start: -21, end: -17, status: 'done', weight: 2, headcount: 3 },
    { name: 'Retiro de escombros', area: 'General', chapter_code: 'demolicion', start: -16, end: -15, status: 'done', weight: 1, headcount: 2 },
    { name: 'Instalación sanitaria', area: 'Baño', chapter_code: 'instalaciones', start: -12, end: -4, status: 'done', weight: 3, headcount: 2 },
    { name: 'Contrapiso y carpeta', area: 'Baño y cocina', chapter_code: 'albanileria', start: -3, end: 2, status: 'in_progress', weight: 3, headcount: 4 },
    { name: 'Instalación eléctrica', area: 'General', chapter_code: 'instalaciones', start: 0, end: 6, status: 'blocked', weight: 3, headcount: 2, blocked: 'Falta el tablero: el proveedor no entregó.' },
    { name: 'Colocación de porcelanato', area: 'Baño y cocina', chapter_code: 'terminaciones', start: 3, end: 12, status: 'pending', weight: 4, headcount: 3 },
    { name: 'Placard a medida', area: 'Dormitorio', chapter_code: 'terminaciones', start: 14, end: 22, status: 'pending', weight: 3, headcount: 2 },
    { name: 'Pintura general', area: 'General', chapter_code: 'terminaciones', start: 24, end: 32, status: 'pending', weight: 2, headcount: 3 },
  ];

  await ActivityModel.deleteMany({ project_id: project._id });
  const activities = await ActivityModel.insertMany(
    activityData.map((a, index) => ({
      project_id: project._id,
      name: a.name,
      area: a.area,
      chapter_code: a.chapter_code,
      planned_start: day(a.start),
      planned_end: day(a.end),
      status: a.status,
      blocked_reason: a.blocked,
      weight: a.weight,
      planned_headcount: a.headcount,
      week: isoWeekKey(day(a.start)),
      completed_at: a.status === 'done' ? day(a.end) : null,
      order: index,
    })),
  );

  const byName = new Map(activities.map((a) => [a.name, a._id]));

  await MaterialModel.deleteMany({ project_id: project._id });
  await MaterialModel.insertMany([
    { project_id: project._id, name: 'Cemento', quantity: 40, unit: 'bolsa', status: 'purchased', estimated_cost: 320000, actual_cost: 336000, chapter_code: 'albanileria', activity_id: byName.get('Contrapiso y carpeta'), created_by: owner.id },
    { project_id: project._id, name: 'Arena', quantity: 3, unit: 'm3', status: 'pending', estimated_cost: 180000, chapter_code: 'albanileria', activity_id: byName.get('Contrapiso y carpeta'), notes: 'Faltan 3 m3 respecto de lo calculado.', created_by: owner.id },
    { project_id: project._id, name: 'Tablero eléctrico', quantity: 1, unit: 'un', status: 'requested', estimated_cost: 420000, chapter_code: 'instalaciones', activity_id: byName.get('Instalación eléctrica'), notes: 'El proveedor no confirma fecha.', created_by: owner.id },
    { project_id: project._id, name: 'Porcelanato 60x60', quantity: 36, unit: 'm2', status: 'pending', estimated_cost: 1080000, chapter_code: 'terminaciones', activity_id: byName.get('Colocación de porcelanato'), created_by: owner.id },
    { project_id: project._id, name: 'Pegamento para porcelanato', quantity: 12, unit: 'bolsa', status: 'pending', estimated_cost: 156000, chapter_code: 'terminaciones', created_by: owner.id },
  ]);

  await WorkerModel.deleteMany({ project_id: project._id });
  const workers = await WorkerModel.insertMany([
    { project_id: project._id, name: 'Ramón Aguirre', trade: 'Oficial albañil' },
    { project_id: project._id, name: 'Kevin Sosa', trade: 'Ayudante' },
    { project_id: project._id, name: 'Nicolás Duarte', trade: 'Electricista' },
    { project_id: project._id, name: 'Julio Medina', trade: 'Plomero' },
  ]);

  const today = toDateKey();
  await AttendanceModel.deleteMany({ project_id: project._id, date: today });
  await AttendanceModel.insertMany([
    { project_id: project._id, worker_id: workers[0]._id, date: today, present: true, activity_id: byName.get('Contrapiso y carpeta'), recorded_by: users[2].id },
    { project_id: project._id, worker_id: workers[1]._id, date: today, present: true, activity_id: byName.get('Contrapiso y carpeta'), recorded_by: users[2].id },
    { project_id: project._id, worker_id: workers[2]._id, date: today, present: false, notes: 'Avisó que no viene.', recorded_by: users[2].id },
  ]);

  await ContingencyModel.deleteMany({ project_id: project._id });
  await ProjectModel.updateOne({ _id: project._id }, { contingency_seq: 2 });
  await ContingencyModel.insertMany([
    {
      project_id: project._id,
      code: 'IMP-001',
      what_happened: 'Hacen falta 3 m3 más de arena de los calculados para el contrapiso.',
      why_happened: 'El nivel del piso existente estaba 4 cm más bajo de lo relevado, así que el contrapiso necesita más espesor.',
      impact_cost: 180000,
      impact_days: 1,
      options: [{ description: 'Usar arena de río en lugar de arena fina en la capa inferior', cost: 132000, days: 1 }],
      urgency: 'blocking',
      blocking_since: new Date(Date.now() - 86400000),
      affected_activity_ids: [byName.get('Contrapiso y carpeta')],
      chapter_code: 'albanileria',
      status: 'sent_to_client',
      created_by: users[2].id,
      internal_approved_by: users[1].id,
      internal_approved_at: new Date(Date.now() - 86400000),
      sent_to_client_at: new Date(Date.now() - 3600000),
      history: [
        { at: new Date(Date.now() - 2 * 86400000).toISOString(), by: users[2].id.toString(), from_status: null, to_status: 'draft' },
        { at: new Date(Date.now() - 2 * 86400000).toISOString(), by: users[2].id.toString(), from_status: 'draft', to_status: 'pending_internal' },
        { at: new Date(Date.now() - 86400000).toISOString(), by: users[1].id.toString(), from_status: 'pending_internal', to_status: 'internal_approved' },
        { at: new Date(Date.now() - 3600000).toISOString(), by: users[1].id.toString(), from_status: 'internal_approved', to_status: 'sent_to_client' },
      ],
    },
    {
      project_id: project._id,
      code: 'IMP-002',
      what_happened: 'El hierro del tabique subió $100.000 respecto de la cotización.',
      why_happened: 'El proveedor discontinuó la barra del 8 y la reemplazó por una de otra marca, más cara.',
      impact_cost: 100000,
      impact_days: 0,
      options: [],
      urgency: 'non_blocking',
      affected_activity_ids: [],
      chapter_code: 'albanileria',
      status: 'pending_internal',
      created_by: users[2].id,
      history: [
        { at: new Date(Date.now() - 4 * 3600000).toISOString(), by: users[2].id.toString(), from_status: null, to_status: 'draft' },
        { at: new Date(Date.now() - 4 * 3600000).toISOString(), by: users[2].id.toString(), from_status: 'draft', to_status: 'pending_internal' },
      ],
    },
  ]);

  console.log('\n✅ Proyecto demo listo: "Remodelación Depto Belgrano"');
  console.log('   Entrá con cualquiera de estas cuentas (contraseña: ' + DEMO_PASSWORD + ')');
  for (const p of people) console.log(`   - ${p.email.padEnd(24)} ${p.role}`);
  console.log('');

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ El seed falló:', error);
  process.exit(1);
});
