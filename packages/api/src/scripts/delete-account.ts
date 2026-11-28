/**
 * Borrado FÍSICO de cuentas de prueba creadas en producción antes de que
 * existiera stage. No es la baja de una persona real: para eso está la baja
 * lógica + `purge-deactivated-accounts`, que conserva el historial.
 *
 *   pnpm --filter @luma/api accounts:delete prueba@x.com otra@x.com          # sólo muestra
 *   pnpm --filter @luma/api accounts:delete prueba@x.com otra@x.com --yes    # borra
 *
 * En Coolify (contenedor `app`): node dist/scripts/delete-account.js <emails…> [--yes]
 *
 * Qué se va con cada cuenta:
 * - Las obras que creó, con todo lo que cuelga de ellas (archivos incluidos).
 * - Las Empresas donde es la única integrante (o donde todas las integrantes
 *   están en la misma lista): suscripción, pagos con sus comprobantes, cliente
 *   de Stripe, proveedores y cuadrilla de la Empresa.
 * - Su bandeja, sus accesos a obras ajenas, sus respuestas de feedback y el
 *   documento `User`.
 *
 * Se NIEGA a borrar una cuenta si quedaría algo apuntándole que no se borra
 * (actividades que creó en la obra de otro, una Empresa compartida con alguien
 * de afuera de la lista…): eso es señal de que la cuenta tocó datos reales, y
 * un `ObjectId` huérfano rompe esas pantallas. Lista qué la frena.
 */
import { readdirSync } from 'node:fs';
import mongoose, { type Model } from 'mongoose';
import { DATABASE_CONFIG } from '../config/app.config.js';
import { USER_REFERENCES } from '../services/account-purge.service.js';
import { moveToTrash, purgeProject } from '../services/project-deletion.service.js';
import { deleteObject } from '../services/storage.service.js';
import { StripeApiError, StripeNotConfiguredError, stripeRequest } from '../services/stripe.client.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyModel = Model<any>;
type Id = mongoose.Types.ObjectId;

/** Registra todos los modelos: el chequeo de referencias los recorre por nombre. */
async function loadModels() {
  const dir = new URL('../models/', import.meta.url);
  const files = readdirSync(dir).filter((f) => /\.(ts|js)$/.test(f) && !f.endsWith('.d.ts'));
  await Promise.all(files.map((f) => import(new URL(f, dir).href)));
}

const model = (name: string): AnyModel => mongoose.model(name);

interface Plan {
  email: string;
  userId: Id;
  name: string;
  role: string;
  organizations: Id[];
  projects: { id: Id; name: string }[];
  blockers: string[];
}

/**
 * Filas con `user` que se borran con la cuenta (o con su Empresa): no cuentan
 * como referencias que quedarían colgando.
 */
const DELETED_WITH_USER = new Set([
  'Notification.user',
  'FeedbackResponse.user',
  'ProjectMembership.user',
  'ProjectClient.user',
  'OrganizationMember.user',
]);

async function plan(email: string, targetIds: Set<string>): Promise<Plan | string> {
  const user = await model('User')
    .findOne({ email: email.trim().toLowerCase() })
    .select('_id name role')
    .lean<{ _id: Id; name: string; role: string }>();
  if (!user) return `No existe una cuenta con ${email}`;

  const userId = user._id;
  const blockers: string[] = [];
  if (user.role === 'admin') blockers.push('es admin de plataforma');

  // Empresas: se borran si todas sus integrantes están en la lista.
  const OrganizationMember = model('OrganizationMember');
  const orgIds: Id[] = await OrganizationMember.find({ user: userId }).distinct('organization');
  const organizations: Id[] = [];
  for (const org of orgIds) {
    const outsiders = await OrganizationMember.countDocuments({
      organization: org,
      user: { $nin: [...targetIds] },
    });
    if (outsiders > 0) blockers.push(`comparte la Empresa ${String(org)} con ${outsiders} cuenta(s) fuera de la lista`);
    else organizations.push(org);
  }

  // Obras: las que creó y las de sus Empresas, papelera incluida.
  const Project = model('Project');
  const projects = await Project.find({
    $or: [{ createdBy: userId }, { organization: { $in: organizations } }],
    deletedAt: { $exists: true }, // nombrar `deletedAt` apaga el hook que esconde la papelera
  })
    .select('_id name organization createdBy')
    .lean<{ _id: Id; name: string; organization: Id; createdBy: Id }[]>();

  for (const p of projects) {
    if (!organizations.some((o) => o.equals(p.organization))) {
      blockers.push(`creó la obra «${p.name}» en una Empresa que no se borra`);
    }
    if (!targetIds.has(String(p.createdBy))) {
      blockers.push(`la obra «${p.name}» de su Empresa la creó alguien fuera de la lista`);
    }
  }

  // Gente de afuera con acceso a esas obras: perdería la obra sin aviso.
  const projectIds = projects.map((p) => p._id);
  const outsiders = await model('ProjectMembership').countDocuments({
    project: { $in: projectIds },
    user: { $nin: [...targetIds] },
  });
  if (outsiders > 0) blockers.push(`${outsiders} acceso(s) de cuentas fuera de la lista a sus obras`);

  // Lo que quedaría apuntando a esta cuenta fuera de lo que se borra.
  for (const [name, fields] of Object.entries(USER_REFERENCES)) {
    const paths = Object.keys(fields).filter((f) => !DELETED_WITH_USER.has(`${name}.${f}`));
    if (paths.length === 0) continue;
    const m = model(name);
    const filter: Record<string, unknown> = { $or: paths.map((f) => ({ [f]: userId })) };
    if (name === 'User') filter._id = { $ne: userId };
    if (name === 'Project') Object.assign(filter, { _id: { $nin: projectIds }, deletedAt: { $exists: true } });
    if (m.schema.path('project')) filter.project = { $nin: projectIds };
    if (m.schema.path('organization')) filter.organization = { $nin: organizations };
    const count = await m.countDocuments(filter);
    if (count > 0) blockers.push(`${count} fila(s) de ${name} fuera de sus obras la referencian`);
  }

  return {
    email,
    userId,
    name: user.name,
    role: user.role,
    organizations,
    projects: projects.map((p) => ({ id: p._id, name: p.name })),
    blockers,
  };
}

async function deleteStripeCustomer(customerId: string) {
  try {
    await stripeRequest('DELETE', `/customers/${encodeURIComponent(customerId)}`);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) return;
    if (error instanceof StripeApiError && error.status === 404) return;
    throw error;
  }
}

/** Lo de afuera primero (archivos, Stripe), el `User` al final: si algo falla, se puede reintentar. */
async function execute(p: Plan) {
  const Project = model('Project');
  for (const { id } of p.projects) {
    const project = await Project.findOne({ _id: id, deletedAt: { $exists: true } });
    if (!project) continue;
    if (!project.deletedAt) await moveToTrash(project, String(p.userId));
    const trashed = await Project.findOne({ _id: id, deletedAt: { $ne: null } });
    if (trashed) await purgeProject(trashed);
  }

  const byOrg = { organization: { $in: p.organizations } };
  const SubscriptionPayment = model('SubscriptionPayment');
  const receipts = await SubscriptionPayment.find({
    $or: [byOrg, { submittedBy: p.userId }],
    'receipt.key': { $exists: true, $ne: null },
  }).lean<{ receipt?: { key?: string } }[]>();
  for (const r of receipts) if (r.receipt?.key) await deleteObject(r.receipt.key);

  const Subscription = model('Subscription');
  const billed = await Subscription.find({ ...byOrg, stripeCustomerId: { $ne: null } }).lean<
    { stripeCustomerId?: string }[]
  >();
  for (const s of billed) if (s.stripeCustomerId) await deleteStripeCustomer(s.stripeCustomerId);

  await SubscriptionPayment.deleteMany({ $or: [byOrg, { submittedBy: p.userId }] });
  await Subscription.deleteMany(byOrg);
  await model('Provider').deleteMany(byOrg);
  await model('CrewMember').deleteMany(byOrg);
  await model('StockMovement').deleteMany(byOrg);
  await model('OrganizationMember').deleteMany({ $or: [byOrg, { user: p.userId }] });
  await model('Organization').deleteMany({ _id: { $in: p.organizations } });

  await model('Notification').deleteMany({ user: p.userId });
  await model('FeedbackResponse').deleteMany({ user: p.userId });
  await model('ProjectMembership').deleteMany({ user: p.userId });
  await model('ProjectClient').deleteMany({ user: p.userId });

  await model('User').deleteOne({ _id: p.userId });
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes('--yes');
  const emails = [...new Set(args.filter((a) => !a.startsWith('--')).map((e) => e.trim().toLowerCase()))];
  if (emails.length === 0) {
    console.error('Uso: accounts:delete <email> [<email>…] [--yes]');
    process.exit(1);
  }

  await loadModels();
  await mongoose.connect(DATABASE_CONFIG.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // Las cuentas de la lista se consideran juntas: una Empresa o una obra
  // compartida entre dos cuentas de prueba se borra entera.
  const found = await model('User')
    .find({ email: { $in: emails } })
    .distinct('_id');
  const targetIds = new Set(found.map(String));

  const plans: Plan[] = [];
  let blocked = false;
  for (const email of emails) {
    const result = await plan(email, targetIds);
    if (typeof result === 'string') {
      console.log(`⚠️  ${result}`);
      continue;
    }
    plans.push(result);
    console.log(`\n• ${result.email} (${result.name}, ${String(result.userId)})`);
    console.log(`  Empresas: ${result.organizations.length} · Obras: ${result.projects.length}`);
    for (const pr of result.projects) console.log(`    - ${pr.name}`);
    if (result.blockers.length > 0) {
      blocked = true;
      console.log('  ⛔ No se borra:');
      for (const b of result.blockers) console.log(`    - ${b}`);
    }
  }

  if (blocked) {
    console.log('\n⛔ Hay cuentas frenadas: no se borró nada. Sacalas de la lista o usá la baja lógica.');
  } else if (!confirm) {
    console.log('\nSimulación: no se borró nada. Repetí con --yes para borrar.');
  } else {
    for (const p of plans) {
      await execute(p);
      console.log(`🗑️  Borrada ${p.email}`);
    }
  }

  await mongoose.disconnect();
  if (blocked) process.exit(1);
}

main().catch(async (error) => {
  console.error('❌ delete-account:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
