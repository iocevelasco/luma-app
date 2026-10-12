/**
 * Completa las obras de demo con el resto de los módulos: documentación
 * (renders y planos), proveedores, personal, cobros, gastos, hitos,
 * contrataciones y el equipo de la Empresa. Complementa a
 * `seed-demo-data.ts`, que sólo crea obras, actividades, materiales, mano de
 * obra y presupuesto.
 *
 * Uso (después de `seed-demo-data.ts`):
 *   SEED_EMAIL=alguien@ejemplo.com pnpm --filter @luma/api exec tsx src/scripts/seed-demo-modules.ts
 *
 * Es re-ejecutable: borra lo que creó la corrida anterior (identificado por
 * `DEMO_TAG`) antes de volver a crear. Sólo toca obras con el prefijo de
 * `seed-demo-data.ts` de la Empresa del usuario.
 *
 * Los documentos llevan una `key` de relleno: no hay archivo detrás. Alcanza
 * para ver listados, tarjetas y filtros; abrir el archivo no funciona.
 */
import mongoose from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { Activity } from '../models/Activity.js';
import { ActivityCrew } from '../models/ActivityCrew.js';
import { ActivityProvider } from '../models/ActivityProvider.js';
import { CrewMember } from '../models/CrewMember.js';
import { Expense } from '../models/Expense.js';
import { Milestone } from '../models/Milestone.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Payment } from '../models/Payment.js';
import { PaymentScheduleItem } from '../models/PaymentScheduleItem.js';
import { Project } from '../models/Project.js';
import { ProjectCrewMember } from '../models/ProjectCrewMember.js';
import { ProjectDocument } from '../models/ProjectDocument.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { ProjectProvider } from '../models/ProjectProvider.js';
import { Provider } from '../models/Provider.js';
import { ProviderEngagement } from '../models/ProviderEngagement.js';
import { User } from '../models/User.js';

const SEED_PREFIX = 'Obra Demo — ';
/** Marca en `notes` de lo que crea este script, para poder borrarlo después. */
const DEMO_TAG = 'SEED_DEMO';

const PROVIDERS = [
  { name: 'Hernán Giménez', companyName: 'Giménez Electricidad', specialty: 'electricidad', phone: '+54 11 5555 0101' },
  { name: 'Marta Ledesma', companyName: 'Sanitarios Ledesma', specialty: 'plomeria', phone: '+54 11 5555 0102' },
  { name: 'Roberto Aguirre', companyName: 'Aguirre Estructuras', specialty: 'estructura', phone: '+54 11 5555 0103' },
  { name: 'Lucía Pereyra', companyName: 'Pinturas Pereyra', specialty: 'pintura', phone: '+54 11 5555 0104' },
  { name: 'Carlos Duarte', companyName: 'Carpintería Duarte', specialty: 'carpinteria', phone: '+54 11 5555 0105' },
  { name: 'Ana Sosa', companyName: 'Techos Sosa', specialty: 'techos', phone: '+54 11 5555 0106' },
] as const;

const CREW = [
  { name: 'Julián Rojas', specialty: 'albanileria', isLead: true, dailyRate: 45000, phone: '+54 11 6000 0001' },
  { name: 'Mateo Vargas', specialty: 'albanileria', isLead: false, dailyRate: 32000, phone: '+54 11 6000 0002' },
  { name: 'Sergio Molina', specialty: 'electricidad', isLead: true, dailyRate: 48000, phone: '+54 11 6000 0003' },
  { name: 'Diego Paz', specialty: 'plomeria', isLead: false, dailyRate: 38000, phone: '+54 11 6000 0004' },
  { name: 'Gonzalo Ferreyra', specialty: 'pintura', isLead: false, dailyRate: 30000, phone: '+54 11 6000 0005' },
  { name: 'Hormigonera 350L', kind: 'equipo', specialty: 'estructura', isLead: false, dailyRate: 18000 },
] as const;

const TEAM = [
  { email: 'demo.gerente@luma.test', name: 'Valeria Núñez', staffRole: 'gerente', phone: '+54 11 4000 0001' },
  { email: 'demo.supervisor@luma.test', name: 'Tomás Ibarra', staffRole: 'supervisor', phone: '+54 11 4000 0002' },
  { email: 'demo.contador@luma.test', name: 'Paula Quiroga', staffRole: 'contador', phone: '+54 11 4000 0003' },
] as const;

function dayKey(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function main() {
  const email = (process.env.SEED_EMAIL ?? 'iocevelasco@gmail.com').trim().toLowerCase();
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  const owner = await User.findOne({ email });
  if (!owner) throw new Error(`No existe un usuario con email ${email}.`);
  const membership = await OrganizationMember.findOne({ user: owner._id, role: 'owner' });
  if (!membership) throw new Error(`El usuario ${email} no es owner de ninguna Organization.`);
  const organizationId = membership.organization;

  const projects = await Project.find({
    organization: organizationId,
    name: { $regex: `^${SEED_PREFIX}` },
  });
  if (projects.length === 0) {
    throw new Error('No hay obras de demo: corré antes seed-demo-data.ts con el mismo SEED_EMAIL.');
  }
  const projectIds = projects.map((p) => p._id);

  // --- Limpieza de la corrida anterior ------------------------------------
  const oldProviders = await Provider.find({ organization: organizationId, notes: DEMO_TAG }).select('_id');
  const oldCrew = await CrewMember.find({ organization: organizationId, notes: DEMO_TAG }).select('_id');
  const oldActivities = await Activity.find({ project: { $in: projectIds } }).select('_id');
  await Promise.all([
    ProjectDocument.deleteMany({ project: { $in: projectIds } }),
    PaymentScheduleItem.deleteMany({ project: { $in: projectIds } }),
    Payment.deleteMany({ project: { $in: projectIds } }),
    Expense.deleteMany({ project: { $in: projectIds } }),
    Milestone.deleteMany({ project: { $in: projectIds } }),
    ProviderEngagement.deleteMany({ project: { $in: projectIds } }),
    ProjectProvider.deleteMany({ project: { $in: projectIds } }),
    ProjectCrewMember.deleteMany({ project: { $in: projectIds } }),
    ProjectMembership.deleteMany({ project: { $in: projectIds } }),
    ActivityProvider.deleteMany({ activity: { $in: oldActivities.map((a) => a._id) } }),
    ActivityCrew.deleteMany({ activity: { $in: oldActivities.map((a) => a._id) } }),
    Provider.deleteMany({ _id: { $in: oldProviders.map((p) => p._id) } }),
    CrewMember.deleteMany({ _id: { $in: oldCrew.map((c) => c._id) } }),
  ]);

  // --- Equipo de la Empresa (con teléfono y rol) ---------------------------
  const teamUsers = [];
  for (const person of TEAM) {
    let user = await User.findOne({ email: person.email });
    if (!user) {
      user = await User.create({
        email: person.email,
        name: person.name,
        role: 'user',
        email_verified: true,
      });
    }
    await OrganizationMember.findOneAndUpdate(
      { organization: organizationId, user: user._id },
      { role: 'member', staffRole: person.staffRole, phone: person.phone },
      { upsert: true, new: true },
    );
    teamUsers.push({ user, staffRole: person.staffRole });
  }
  const supervisor = teamUsers.find((t) => t.staffRole === 'supervisor')!.user;
  const accountant = teamUsers.find((t) => t.staffRole === 'contador')!.user;

  // --- Proveedores y personal de la Empresa --------------------------------
  const providers = await Provider.insertMany(
    PROVIDERS.map((p) => ({
      organization: organizationId,
      scope: 'organization',
      ...p,
      email: `${p.companyName.toLowerCase().replace(/[^a-z]/g, '')}@demo.test`,
      notes: DEMO_TAG,
    })),
  );
  const crew = await CrewMember.insertMany(
    CREW.map((c) => ({
      organization: organizationId,
      scope: 'organization',
      kind: 'persona',
      ...c,
      notes: DEMO_TAG,
    })),
  );

  const counts = { documents: 0, schedule: 0, payments: 0, expenses: 0, milestones: 0, engagements: 0 };

  for (const [index, project] of projects.entries()) {
    const currency = project.currency;
    const activities = await Activity.find({ project: project._id }).sort({ startDate: 1 });
    const base = 1_000_000 * (index + 1);

    // Documentación: renders y planos (lo que muestran las tarjetas nuevas).
    const docs = [
      { category: 'render', title: 'Render fachada principal', space: 'Fachada' },
      { category: 'render', title: 'Render living-comedor', space: 'Interior' },
      { category: 'plano', title: 'Plano de arquitectura — planta baja', space: 'Planta baja' },
      { category: 'plano', title: 'Plano de instalación eléctrica', space: 'Planta baja' },
      { category: 'plano', title: 'Plano de estructura', space: 'Subsuelo' },
      { category: 'permiso_municipal', title: 'Permiso de obra municipal' },
    ] as const;
    await ProjectDocument.insertMany(
      docs.map((doc, i) => ({
        project: project._id,
        ...doc,
        key: `demo/${String(project._id)}/${i}.${doc.category === 'render' ? 'jpg' : 'pdf'}`,
        fileName: `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${doc.category === 'render' ? 'jpg' : 'pdf'}`,
        contentType: doc.category === 'render' ? 'image/jpeg' : 'application/pdf',
        sizeBytes: 800_000 + i * 120_000,
        uploadedBy: owner._id,
        // Fechas escalonadas para que "los últimos 3" tengan orden visible.
        createdAt: new Date(Date.now() - (docs.length - i) * 3 * 86_400_000),
      })),
    );
    counts.documents += docs.length;

    // Proveedores de la obra, asignados a actividades de su especialidad.
    const projectProviders = providers.slice(index % 3, (index % 3) + 4);
    await ProjectProvider.insertMany(
      projectProviders.map((provider) => ({ project: project._id, provider: provider._id })),
    );
    const providerLinks = activities.slice(0, 6).map((activity, i) => ({
      activity: activity._id,
      provider: projectProviders[i % projectProviders.length]!._id,
    }));
    await ActivityProvider.insertMany(providerLinks);

    // Contrataciones: una aprobada con adelanto, una pedida.
    await ProviderEngagement.insertMany([
      {
        project: project._id,
        provider: projectProviders[0]!._id,
        status: 'aprobada',
        quotedAmount: Math.round(base * 0.18),
        advanceAmount: Math.round(base * 0.05),
        estimatedStartDate: dayKey(7),
        notes: DEMO_TAG,
        createdBy: owner._id,
      },
      {
        project: project._id,
        provider: projectProviders[1]!._id,
        status: 'solicitada',
        createdBy: owner._id,
        notes: DEMO_TAG,
      },
    ]);
    counts.engagements += 2;

    // Personal de la obra y asignación a actividades.
    const projectCrew = crew.slice(0, 5);
    await ProjectCrewMember.insertMany(
      projectCrew.map((member) => ({ project: project._id, crewMember: member._id })),
    );
    await ActivityCrew.insertMany(
      activities.slice(0, 5).map((activity, i) => ({
        activity: activity._id,
        crewMember: projectCrew[i % projectCrew.length]!._id,
      })),
    );

    // Cobros: cronograma de 3 cuotas y 1–2 cobros registrados.
    const schedule = await PaymentScheduleItem.insertMany(
      [
        { order: 0, concept: 'Anticipo', amount: Math.round(base * 0.3), dueOn: dayKey(-40) },
        { order: 1, concept: 'Avance de estructura', amount: Math.round(base * 0.4), dueOn: dayKey(-5) },
        { order: 2, concept: 'Entrega final', amount: Math.round(base * 0.3), dueOn: dayKey(60) },
      ].map((item) => ({ project: project._id, currency, exchangeRate: 1, ...item })),
    );
    counts.schedule += schedule.length;
    const payments = [
      { scheduleItem: schedule[0]!._id, amount: schedule[0]!.amount, paidOn: dayKey(-38), method: 'transferencia' },
      ...(index % 2 === 0
        ? [{ scheduleItem: schedule[1]!._id, amount: Math.round(schedule[1]!.amount / 2), paidOn: dayKey(-3), method: 'cheque' }]
        : []),
    ];
    await Payment.insertMany(
      payments.map((payment) => ({
        project: project._id,
        currency,
        exchangeRate: 1,
        registeredBy: owner._id,
        reference: `REC-${index + 1}-${payment.paidOn}`,
        ...payment,
      })),
    );
    counts.payments += payments.length;

    // Gastos con distintas categorías, algunos atados a proveedor/actividad.
    const expenses = [
      { category: 'material', description: 'Cemento y arena', amount: Math.round(base * 0.04), spentOn: dayKey(-30), provider: projectProviders[2]?._id },
      { category: 'nomina', description: 'Quincena cuadrilla', amount: Math.round(base * 0.06), spentOn: dayKey(-15), activity: activities[0]?._id },
      { category: 'herramienta', description: 'Alquiler de andamios', amount: Math.round(base * 0.015), spentOn: dayKey(-10) },
      { category: 'insumo', description: 'Pintura y rodillos', amount: Math.round(base * 0.01), spentOn: dayKey(-2), provider: projectProviders[3]?._id },
    ];
    await Expense.insertMany(
      expenses.map((expense) => ({
        project: project._id,
        currency,
        exchangeRate: 1,
        registeredBy: owner._id,
        ...expense,
      })),
    );
    counts.expenses += expenses.length;

    // Hitos: uno para el cliente, uno interno y uno de atención.
    const milestones = [
      { type: 'etapa_concluida', audience: 'cliente', severity: 'info', title: 'Fundaciones terminadas', description: 'Se completó el hormigonado de platea.', occurredOn: dayKey(-25) },
      { type: 'compra_significativa', audience: 'interno', severity: 'info', title: 'Compra de hierros', description: 'Pedido cerrado con el corralón.', occurredOn: dayKey(-12) },
      { type: 'retraso', audience: 'cliente', severity: 'atencion', title: 'Demora por lluvias', description: 'Dos jornadas sin poder trabajar en exterior.', occurredOn: dayKey(-4) },
    ] as const;
    await Milestone.insertMany(
      milestones.map((milestone) => ({
        project: project._id,
        reportedBy: owner._id,
        activity: milestone.type === 'etapa_concluida' ? activities[0]?._id : null,
        ...milestone,
      })),
    );
    counts.milestones += milestones.length;

    // Equipo de la obra: supervisor y contador en las primeras tres.
    if (index < 3) {
      await ProjectMembership.insertMany([
        { project: project._id, user: supervisor._id, role: 'supervisor', invitedBy: owner._id },
        { project: project._id, user: accountant._id, role: 'contador', invitedBy: owner._id },
      ]);
    }

    console.log(`✅ ${project.name}`);
  }

  console.log('');
  console.log(`Equipo de la Empresa: ${TEAM.length} personas (con rol y teléfono)`);
  console.log(`Proveedores: ${providers.length} · Personal: ${crew.length}`);
  console.log(`Documentos: ${counts.documents} · Contrataciones: ${counts.engagements}`);
  console.log(`Cuotas: ${counts.schedule} · Cobros: ${counts.payments} · Gastos: ${counts.expenses}`);
  console.log(`Hitos: ${counts.milestones}`);
  console.log('');
  console.log(`Listo. Entrá con ${email} para recorrer todos los módulos.`);
}

main()
  .catch((err) => {
    console.error('❌', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
