/**
 * Cuentas de demostración, una por cada estado de la suscripción, para
 * recorrer los flujos a mano sin esperar 30 días a que venza una prueba.
 *
 *   pnpm --filter @luma/api seed:subscription-demo
 *
 * Todas con la contraseña `Demo12345!`:
 *
 * | Cuenta                         | Estado                                         |
 * |--------------------------------|------------------------------------------------|
 * | demo-gratis@luma.test          | Gratis, 20 días, 2 obras                       |
 * | demo-por-vencer@luma.test      | Gratis, 3 días, 3 obras (aviso + 4ª obra)      |
 * | demo-pro@luma.test             | Pro pagado en Bs, 4 obras (una extra)          |
 * | demo-en-revision@luma.test     | Prueba vencida + pago en Bs esperando revisión |
 * | demo-vencida@luma.test         | Vencida, sólo lectura (con un pago rechazado)  |
 *
 * Cada corrida las deja como nuevas: borra lo que esas cinco cuentas tenían
 * (obras, Empresa, suscripción, pagos) y lo vuelve a crear con fechas
 * relativas a hoy. No toca ninguna otra cuenta.
 *
 * También deja una tasa BCV: lee la real y, si el BCV no responde, carga una
 * a mano. Sin tasa no hay pago en bolívares.
 *
 * Sólo contra una base local, igual que `seed-e2e-users.ts`.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { PLAN, addMonths, usdToBolivares, type ChargeLine } from '@luma/shared';
import { DATABASE_CONFIG, SERVER_CONFIG } from '../config/app.config.js';
import { ExchangeRate } from '../models/ExchangeRate.js';
import { Organization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Project } from '../models/Project.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { Subscription } from '../models/Subscription.js';
import { SubscriptionPayment } from '../models/SubscriptionPayment.js';
import { User } from '../models/User.js';
import { caracasDayKey, currentRate, refreshBcvRate } from '../services/bcv.service.js';
import { createPersonalOrganization } from '../services/organization.service.js';

const PASSWORD = 'Demo12345!';
const DAY = 24 * 60 * 60 * 1000;

interface DemoAccount {
  email: string;
  name: string;
  /** Días desde que arrancó la prueba (30 = termina hoy). */
  trialStartedDaysAgo: number;
  projects: number;
  build?: (ctx: { organization: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; now: Date; rate: number; rateDate: string }) => Promise<void>;
}

const base = (): ChargeLine => ({ kind: 'base', quantity: 1, unitUsd: PLAN.basePriceUsd, amountUsd: PLAN.basePriceUsd });

const ACCOUNTS: DemoAccount[] = [
  { email: 'demo-gratis@luma.test', name: 'Demo Gratis', trialStartedDaysAgo: 10, projects: 2 },
  { email: 'demo-por-vencer@luma.test', name: 'Demo Por Vencer', trialStartedDaysAgo: 27, projects: 3 },
  {
    email: 'demo-pro@luma.test',
    name: 'Demo Pro',
    trialStartedDaysAgo: 40,
    projects: 4,
    // Pasó a Pro hace 10 días pagando en Bs el plan + 1 extra.
    build: async ({ organization, now, rate, rateDate }) => {
      const start = new Date(now.getTime() - 10 * DAY);
      const lines: ChargeLine[] = [
        base(),
        { kind: 'extra', quantity: 1, unitUsd: PLAN.extraProjectPriceUsd, amountUsd: PLAN.extraProjectPriceUsd },
      ];
      const totalUsd = PLAN.basePriceUsd + PLAN.extraProjectPriceUsd;
      await SubscriptionPayment.create({
        organization,
        method: 'pago_movil',
        status: 'aprobado',
        periodStart: start,
        periodEnd: addMonths(start, 1),
        lines,
        totalUsd,
        bcvRate: rate,
        rateValueDate: rateDate,
        amountBs: usdToBolivares(totalUsd, rate),
        declaredAmountBs: usdToBolivares(totalUsd, rate),
        bank: 'BANESCO',
        reference: '90000001',
        payerId: 'V-11111111',
        paidOn: caracasDayKey(start),
        submittedAt: start,
        reviewedAt: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      });
    },
  },
  {
    email: 'demo-en-revision@luma.test',
    name: 'Demo En Revisión',
    trialStartedDaysAgo: 35,
    projects: 2,
    // Mandó hace una hora un pago que todavía nadie revisó. Declaró un 5%
    // menos de lo cotizado: así se ve el aviso de "no coincide" en la cola.
    build: async ({ organization, now, rate, rateDate }) => {
      const submittedAt = new Date(now.getTime() - 60 * 60 * 1000);
      const amountBs = usdToBolivares(PLAN.basePriceUsd, rate);
      await SubscriptionPayment.create({
        organization,
        method: 'transferencia',
        status: 'pendiente',
        periodStart: submittedAt,
        periodEnd: addMonths(submittedAt, 1),
        lines: [base()],
        totalUsd: PLAN.basePriceUsd,
        bcvRate: rate,
        rateValueDate: rateDate,
        amountBs,
        declaredAmountBs: Math.round(amountBs * 0.95 * 100) / 100,
        bank: 'BANCO DE VENEZUELA',
        reference: '90000002',
        payerId: 'V-22222222',
        paidOn: caracasDayKey(submittedAt),
        submittedAt,
      });
    },
  },
  {
    email: 'demo-vencida@luma.test',
    name: 'Demo Vencida',
    trialStartedDaysAgo: 40,
    projects: 1,
    // Intentó pagar y se lo rechazaron: aparece en su historial con el motivo.
    build: async ({ organization, now, rate, rateDate }) => {
      const submittedAt = new Date(now.getTime() - 8 * DAY);
      await SubscriptionPayment.create({
        organization,
        method: 'pago_movil',
        status: 'rechazado',
        periodStart: submittedAt,
        periodEnd: addMonths(submittedAt, 1),
        lines: [base()],
        totalUsd: PLAN.basePriceUsd,
        bcvRate: rate,
        rateValueDate: rateDate,
        amountBs: usdToBolivares(PLAN.basePriceUsd, rate),
        declaredAmountBs: usdToBolivares(PLAN.basePriceUsd, rate),
        bank: 'MERCANTIL',
        reference: '90000003',
        payerId: 'V-33333333',
        paidOn: caracasDayKey(submittedAt),
        submittedAt,
        reviewedAt: new Date(submittedAt.getTime() + DAY),
        rejectionReason: 'La referencia no aparece en el banco. Revisá el número y volvé a mandarlo.',
      });
    },
  },
];

const PROJECT_NAMES = ['Baño Los Palos Grandes', 'Cocina Altamira', 'Local Chacao', 'Oficina El Rosal'];

async function wipe(email: string) {
  const user = await User.findOne({ email });
  if (!user) return;
  const orgIds = await OrganizationMember.find({ user: user._id, role: 'owner' }).distinct('organization');
  const projectIds = await Project.find({ organization: { $in: orgIds } }).distinct('_id');
  await Promise.all([
    ProjectMembership.deleteMany({ project: { $in: projectIds } }),
    Project.deleteMany({ _id: { $in: projectIds } }),
    Subscription.deleteMany({ organization: { $in: orgIds } }),
    SubscriptionPayment.deleteMany({ organization: { $in: orgIds } }),
    OrganizationMember.deleteMany({ organization: { $in: orgIds } }),
    Organization.deleteMany({ _id: { $in: orgIds } }),
  ]);
  await User.deleteOne({ _id: user._id });
}

async function ensureRate(now: Date): Promise<{ usd: number; valueDate: string }> {
  try {
    const outcome = await refreshBcvRate(now);
    console.log(`✅ Tasa BCV leída: ${outcome.rate.usd} (fecha valor ${outcome.rate.valueDate})`);
  } catch (error) {
    const existing = await currentRate(now);
    if (!existing) {
      await ExchangeRate.create({
        source: 'manual',
        usd: 880,
        valueDate: caracasDayKey(now),
        fetchedAt: now,
        lastSeenAt: now,
      });
      console.log('⚠️  El BCV no respondió: cargué una tasa de demostración de 880 Bs/USD.');
    } else {
      console.log(`⚠️  El BCV no respondió (${(error as Error).message}); queda la última tasa.`);
    }
  }
  const rate = await currentRate(now);
  return { usd: rate!.usd, valueDate: rate!.valueDate };
}

async function main() {
  const uri = DATABASE_CONFIG.MONGODB_URI;
  if (!/(localhost|127\.0\.0\.1|\[::1\])/.test(uri) || SERVER_CONFIG.NODE_ENV === 'production') {
    console.error('❌ Sólo contra una base local: este script crea cuentas con una contraseña conocida.');
    process.exit(1);
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  const now = new Date();
  const rate = await ensureRate(now);
  const password = await bcrypt.hash(PASSWORD, 10);

  for (const account of ACCOUNTS) {
    await wipe(account.email);
    const user = await User.create({
      email: account.email,
      name: account.name,
      password,
      role: 'user',
      email_verified: true,
    });
    const organization = await createPersonalOrganization(String(user._id), account.name);
    const trialStartedAt = new Date(now.getTime() - account.trialStartedDaysAgo * DAY);
    await Subscription.create({
      organization: organization._id,
      owner: user._id,
      trialStartedAt,
      trialEndsAt: new Date(trialStartedAt.getTime() + PLAN.trialDays * DAY),
    });
    for (let i = 0; i < account.projects; i++) {
      // Fechas de creación dentro de la prueba, la primera más vieja.
      const createdAt = new Date(trialStartedAt.getTime() + (i + 1) * 60 * 60 * 1000);
      await Project.create({
        organization: organization._id,
        createdBy: user._id,
        name: PROJECT_NAMES[i],
        description: 'Obra de demostración de la suscripción.',
        location: 'Caracas',
        estimatedStartDate: caracasDayKey(now),
        estimatedEndDate: caracasDayKey(new Date(now.getTime() + 60 * DAY)),
        currency: 'USD',
        createdAt,
      });
    }
    await account.build?.({
      organization: organization._id as mongoose.Types.ObjectId,
      userId: user._id as mongoose.Types.ObjectId,
      now,
      rate: rate.usd,
      rateDate: rate.valueDate,
    });
    console.log(`✅ ${account.email.padEnd(28)} ${account.name}`);
  }

  console.log(`\nContraseña de todas: ${PASSWORD}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ seed-subscription-demo:', error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
