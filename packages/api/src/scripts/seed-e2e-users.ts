/**
 * Siembra las cuentas fijas de E2E: una por cada tipo de usuario que los specs
 * necesitan —admin de plataforma, usuario sin obras, una persona por rol de
 * obra y una cuenta dada de baja— y la obra compartida donde cada rol tiene
 * su lugar.
 *
 * La lista NO vive acá sino en `e2e/fixtures/users.json`: los specs leen ese
 * mismo archivo, así que sumar un tipo de usuario es agregar una entrada y no
 * tocar dos listas que se desincronizan a la primera.
 *
 * Lo corre solo el globalSetup de Playwright antes de cada tanda local. A mano:
 *   pnpm seed:e2e
 *
 * El globalSetup le pasa la lista ya resuelta en `E2E_USERS_JSON` (con los
 * overrides `E2E_<CLAVE>_EMAIL` aplicados), para que el seed siembre las
 * mismas cuentas con las que después se loguean los tests.
 *
 * Es idempotente: reusa lo que existe y lo deja como dice el fixture
 * (contraseña, rol, estado, membresía). No borra nada.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import {
  addMonths,
  INVITABLE_PROJECT_ROLES,
  LEGAL_VERSION,
  type AccountStatus,
  type InvitableProjectRole,
  type ProjectRole,
  type UserRole,
} from '@luma/shared';
import { DATABASE_CONFIG, SERVER_CONFIG } from '../config/app.config.js';
import { Project } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { SubscriptionPayment } from '../models/SubscriptionPayment.js';
import { User, type IUser } from '../models/User.js';
import {
  createPersonalOrganization,
  findMyOrganizationId,
} from '../services/organization.service.js';
import { startTrialFor } from '../services/subscription.service.js';

const FIXTURE_FILE = fileURLToPath(new URL('../../../../e2e/fixtures/users.json', import.meta.url));
const BCRYPT_ROUNDS = 10;

/**
 * Sólo cuentas del dominio reservado `.test` (RFC 2606): no hay casilla real
 * detrás. Si un override apunta a una cuenta de verdad, el seed le pisaría la
 * contraseña — se saltea y se avisa.
 */
const TEST_EMAIL = /@[^@\s]+\.test$/i;

interface E2EUserFixture {
  email: string;
  password: string;
  name: string;
  platformRole: UserRole;
  projectRole?: ProjectRole;
  accountStatus?: AccountStatus;
}

interface E2EFixture {
  project: {
    name: string;
    description: string;
    location: string;
    estimatedStartDate: string;
    estimatedEndDate: string;
    currency: string;
    providersVisibleToClient: boolean;
  };
  users: Record<string, E2EUserFixture>;
}

function loadFixture(): E2EFixture {
  const fixture = JSON.parse(fs.readFileSync(FIXTURE_FILE, 'utf8')) as E2EFixture;
  const resolved = process.env.E2E_USERS_JSON;
  if (resolved) fixture.users = JSON.parse(resolved) as E2EFixture['users'];
  return fixture;
}

function isInvitable(role: ProjectRole | undefined): role is InvitableProjectRole {
  return (INVITABLE_PROJECT_ROLES as readonly string[]).includes(role ?? '');
}

/** Crea la cuenta si no existe; si existe, la deja exactamente como dice el fixture. */
async function upsertUser(fixture: E2EUserFixture): Promise<IUser> {
  const active = (fixture.accountStatus ?? 'active') === 'active';
  const user = (await User.findOne({ email: fixture.email.toLowerCase() })) ?? new User();

  user.email = fixture.email;
  user.name = fixture.name;
  user.password = await bcrypt.hash(fixture.password, BCRYPT_ROUNDS);
  user.role = fixture.platformRole;
  user.email_verified = true;
  // Aceptación vigente: sin ella el modal de Términos tapa el panel y trabaría
  // toda la suite con sesión. Es el único lugar donde fabricarla es legítimo.
  user.termsVersion = LEGAL_VERSION;
  user.termsAcceptedAt = user.termsAcceptedAt ?? new Date();
  user.enabled = active;
  user.account_status = active ? 'active' : 'inactive';
  user.deactivated_at = active ? undefined : (user.deactivated_at ?? new Date());
  await user.save();

  // Mismo invariante que `register()`: toda cuenta tiene su Empresa personal.
  const userId = String(user._id);
  if (!(await findMyOrganizationId(userId))) {
    await createPersonalOrganization(userId, `Empresa de ${fixture.name}`);
  }
  await ensureCourtesyPeriod(userId);

  return user;
}

/**
 * Un año pago de cortesía para cada Empresa de E2E.
 *
 * Los specs crean obras en cada corrida y la base local no se limpia: con el
 * tope de 3 obras de la prueba, a la segunda tanda ya no se podría crear
 * ninguna, y un test de obras fallaría por una regla de la suscripción que
 * no está probando. Los estados de la suscripción (prueba, vencida…) se
 * prueban con sus propias cuentas, no con éstas.
 *
 * Idempotente: si ya hay un período aprobado que cubre hoy, no hace nada.
 */
async function ensureCourtesyPeriod(userId: string) {
  const organization = await findMyOrganizationId(userId);
  if (!organization) return;

  const now = new Date();
  const covered = await SubscriptionPayment.exists({
    organization,
    status: 'aprobado',
    periodStart: { $lte: now },
    periodEnd: { $gt: now },
  });
  if (covered) return;

  await startTrialFor(organization, userId, now);
  await SubscriptionPayment.create({
    organization,
    method: 'transferencia',
    status: 'aprobado',
    periodStart: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    periodEnd: addMonths(now, 12),
    totalUsd: 0,
    lines: [],
    bank: 'e2e',
    reference: `e2e-${organization}-${now.getTime()}`,
    submittedAt: now,
    reviewedAt: now,
  });
}

async function main() {
  // Guardarraíl: este script escribe contraseñas conocidas. Contra una base
  // que no sea local, eso es un agujero, no una comodidad.
  const uri = DATABASE_CONFIG.MONGODB_URI;
  const isLocal = /(localhost|127\.0\.0\.1|\[::1\])/.test(uri);
  if (!isLocal && process.env.SEED_ALLOW_REMOTE !== 'yes') {
    console.error(
      '❌ MONGODB_URI no apunta a localhost. Este script crea cuentas con una ' +
        'contraseña conocida y sólo es para desarrollo local.',
    );
    process.exit(1);
  }
  if (SERVER_CONFIG.NODE_ENV === 'production') {
    console.error('❌ NODE_ENV=production. Este script es sólo para desarrollo local.');
    process.exit(1);
  }

  const fixture = loadFixture();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  // ── 1. Las cuentas ────────────────────────────────────────────────────────
  const users = new Map<string, IUser>();
  for (const [key, person] of Object.entries(fixture.users)) {
    if (!TEST_EMAIL.test(person.email)) {
      console.warn(`⚠️  ${key}: ${person.email} no es una cuenta .test — no se toca`);
      continue;
    }
    users.set(key, await upsertUser(person));
    console.log(`✅ ${key.padEnd(10)} ${person.email}`);
  }

  // ── 2. La obra compartida, del gerente ────────────────────────────────────
  const managerKey = Object.keys(fixture.users).find(
    (key) => fixture.users[key].projectRole === 'gerente',
  );
  const manager = managerKey ? users.get(managerKey) : undefined;
  if (!manager) {
    console.log('ℹ️  Sin gerente en el fixture: no se siembra la obra.');
    await mongoose.disconnect();
    return;
  }

  const organization = await findMyOrganizationId(String(manager._id));
  const project = await Project.findOneAndUpdate(
    { organization, createdBy: manager._id, name: fixture.project.name },
    { $set: { ...fixture.project, status: 'active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // ── 3. Una membresía por rol invitable ────────────────────────────────────
  for (const [key, person] of Object.entries(fixture.users)) {
    const user = users.get(key);
    if (!user || !isInvitable(person.projectRole)) continue;
    await ProjectMembership.updateOne(
      { project: project._id, user: user._id },
      { $set: { role: person.projectRole }, $setOnInsert: { invitedBy: manager._id } },
      { upsert: true },
    );
  }
  console.log(`✅ obra       ${project.name}`);

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ seed-e2e-users falló:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
