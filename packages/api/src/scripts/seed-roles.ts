/**
 * Crea una obra de prueba con **una persona por rol**, para poder entrar con
 * cada una y ver qué muestra y qué bloquea la app.
 *
 * Es sólo para desarrollo local. Las cuentas quedan activadas (verificadas y
 * con contraseña) para poder loguearse sin pasar por el mail, cosa que en
 * producción nunca ocurre: ahí el alta manda un correo de activación.
 *
 * Uso:
 *   pnpm --filter @luma/api exec tsx src/scripts/seed-roles.ts
 *
 * Es re-ejecutable: borra la obra anterior con el mismo nombre y sus
 * membresías antes de crear, así que no duplica. **No borra los usuarios** —
 * si ya existen, les reasigna la contraseña de abajo y los reusa.
 *
 * `--reset-password` fuerza el reseteo aunque el usuario ya exista.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import type { InvitableProjectRole } from '@luma/shared';
import { DATABASE_CONFIG, SERVER_CONFIG } from '../config/app.config.js';
import { Organization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Project } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { User } from '../models/User.js';

/**
 * Contraseña de las cuatro cuentas de prueba.
 *
 * Vive acá, en el repo, a propósito: son cuentas de una base local y no
 * protegen nada. Tenerla escrita evita el ida y vuelta de "¿cuál era?" y deja
 * claro que NO es un secreto — si alguna vez este script se corre contra algo
 * que no sea localhost, el problema es ese, no la contraseña.
 */
const PASSWORD = 'LumaRoles2026!';

const PROJECT_NAME = 'Obra de prueba — roles';
const BCRYPT_ROUNDS = 10;

interface SeedPerson {
  email: string;
  name: string;
  /** `null` es el gerente: no lleva membresía, se deriva de `createdBy`. */
  role: InvitableProjectRole | null;
}

const PEOPLE: SeedPerson[] = [
  { email: 'gerente@luma.test', name: 'Gabriela Gerente', role: null },
  { email: 'supervisor@luma.test', name: 'Sergio Supervisor', role: 'supervisor' },
  { email: 'contador@luma.test', name: 'Carla Contadora', role: 'contador' },
  { email: 'cliente@luma.test', name: 'Clara Cliente', role: 'cliente' },
];

/** Crea la persona si no existe; si existe, la deja usable. */
async function upsertPerson(person: SeedPerson, resetPassword: boolean) {
  const hashed = await bcrypt.hash(PASSWORD, BCRYPT_ROUNDS);
  const existing = await User.findOne({ email: person.email });

  if (existing) {
    // Una cuenta vieja puede haber quedado deshabilitada o sin verificar de
    // una prueba anterior; se normaliza para que pueda entrar.
    existing.name = person.name;
    existing.email_verified = true;
    existing.enabled = true;
    existing.account_status = 'active';
    if (resetPassword || !existing.password) existing.password = hashed;
    await existing.save();
    return { user: existing, created: false };
  }

  const user = await User.create({
    email: person.email,
    name: person.name,
    password: hashed,
    role: 'user',
    email_verified: true,
    enabled: true,
    account_status: 'active',
  });

  return { user, created: true };
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

  const resetPassword = process.argv.includes('--reset-password');

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log(`🔌 Conectado a ${uri}\n`);

  // ── 1. Las cuatro personas ────────────────────────────────────────────────
  const people = [];
  for (const person of PEOPLE) {
    const { user, created } = await upsertPerson(person, resetPassword);
    people.push({ ...person, user });
    console.log(`${created ? '✅ creado ' : '♻️  reusado'} ${person.email}`);
  }

  const manager = people[0];

  // ── 2. La Empresa del gerente ─────────────────────────────────────────────
  let membership = await OrganizationMember.findOne({ user: manager.user._id, role: 'owner' });
  if (!membership) {
    const organization = await Organization.create({ name: `Empresa de ${manager.name}` });
    membership = await OrganizationMember.create({
      organization: organization._id,
      user: manager.user._id,
      role: 'owner',
    });
    console.log(`\n✅ Empresa creada: ${organization.name}`);
  } else {
    console.log('\n♻️  El gerente ya tenía Empresa');
  }

  // ── 3. La obra, limpia ────────────────────────────────────────────────────
  const previous = await Project.findOne({
    name: PROJECT_NAME,
    organization: membership.organization,
  });
  if (previous) {
    await ProjectMembership.deleteMany({ project: previous._id });
    await Project.findByIdAndDelete(previous._id);
    console.log('🧹 Obra anterior borrada');
  }

  const project = await Project.create({
    organization: membership.organization,
    createdBy: manager.user._id,
    name: PROJECT_NAME,
    description: 'Obra sembrada para probar qué ve y qué puede hacer cada rol.',
    location: 'CABA',
    estimatedStartDate: '2026-10-01',
    estimatedEndDate: '2027-03-31',
    currency: 'ARS',
    budgetType: 'cerrado',
    // Encendido a propósito: es la única capacidad del cliente que depende de
    // un flag, y apagada no se puede ver la diferencia entre los dos casos.
    providersVisibleToClient: true,
  });
  console.log(`✅ Obra creada: ${project.name}`);

  // ── 4. Las membresías ─────────────────────────────────────────────────────
  for (const person of people) {
    if (!person.role) continue;
    await ProjectMembership.create({
      project: project._id,
      user: person.user._id,
      role: person.role,
      invitedBy: manager.user._id,
    });
    console.log(`✅ ${person.email} → ${person.role}`);
  }

  console.log('\n────────────────────────────────────────');
  console.log('Entrá con cualquiera de estas cuentas:\n');
  for (const person of people) {
    console.log(`  ${person.email.padEnd(24)} ${person.role ?? 'gerente'}`);
  }
  console.log(`\n  Contraseña (las cuatro): ${PASSWORD}`);
  console.log('────────────────────────────────────────');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ Seed fallido:', error);
  await mongoose.disconnect();
  process.exit(1);
});
