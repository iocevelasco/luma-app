import { ACCOUNT_PURGE_RETENTION_DAYS } from '@luma/shared';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';
import { Organization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { Project } from '../models/Project.js';
import { ProjectClient } from '../models/ProjectClient.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { Subscription } from '../models/Subscription.js';
import { SubscriptionPayment } from '../models/SubscriptionPayment.js';
import { User } from '../models/User.js';
import { deleteObject } from './storage.service.js';
import { StripeApiError, StripeNotConfiguredError, stripeRequest } from './stripe.client.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Lo que queda donde antes había un nombre. */
export const PURGED_NAME = 'Cuenta eliminada';
const PURGED_ORGANIZATION_NAME = 'Empresa eliminada';

export function purgedEmail(userId: unknown): string {
  return `purged-${String(userId)}@purged.invalid`;
}

/**
 * QUÉ pasa con cada lugar donde una persona deja datos. Es el inventario que
 * `purgeAccount` cumple, y los tests lo cruzan contra los esquemas de Mongoose:
 * un modelo nuevo con una referencia a `User`, o un campo que parezca un dato
 * personal, que nadie clasificó acá rompe el build. Lo mismo que hace
 * `PROJECT_OWNED` con las obras: un olvido no puede ser silencioso, porque la
 * Política de Privacidad promete borrar.
 *
 * - `owner-deleted`: la fila es de la persona (su bandeja, sus accesos): se borra.
 * - `owner-scrubbed`: la fila queda —tiene otros datos que importan— pero se le
 *   quita lo que identifica a la persona.
 * - `history`: sólo un `ObjectId` hacia `User` (quién creó, quién aprobó). No
 *   lleva datos personales: apunta al `User` ya anonimizado.
 */
export type UserRefTreatment = 'owner-deleted' | 'owner-scrubbed' | 'history';

export const USER_REFERENCES: Record<string, Record<string, UserRefTreatment>> = {
  Activity: {
    // El responsable: se le pisa el nombre (paso 2 de `purgeAccount`).
    'responsible.user': 'owner-scrubbed',
    'evidence.uploadedBy': 'history',
    'review.reportedBy': 'history',
    'review.approvedBy': 'history',
    'review.rejectedBy': 'history',
    createdBy: 'history',
  },
  Budget: { importedBy: 'history' },
  // Quién publicó el prompt del asistente. El texto no es un dato personal.
  ChatPrompt: { updatedBy: 'history' },
  CrewGoal: { createdBy: 'history' },
  ExchangeRate: { createdBy: 'history' },
  Expense: { registeredBy: 'history' },
  LaborRecord: { createdBy: 'history' },
  MaterialItem: { statusChangedBy: 'history', 'photo.uploadedBy': 'history', createdBy: 'history' },
  Milestone: { 'attachments.uploadedBy': 'history', reportedBy: 'history' },
  Notification: { user: 'owner-deleted' },
  OrganizationMember: { user: 'owner-scrubbed' },
  Payment: { registeredBy: 'history' },
  Project: { createdBy: 'history', deletedBy: 'history' },
  ProjectClient: { user: 'owner-deleted', invitedBy: 'history' },
  ProjectDocument: { uploadedBy: 'history' },
  ProjectMembership: { user: 'owner-deleted', invitedBy: 'history' },
  ProviderEngagement: { createdBy: 'history' },
  Subscription: { owner: 'owner-scrubbed' },
  SubscriptionPayment: { submittedBy: 'owner-scrubbed', reviewedBy: 'history' },
  User: { activationLinkHeldBy: 'history', claimedViaLinkBy: 'history', deactivated_by: 'history' },
};

/**
 * Campos que por su nombre parecen un dato personal, y qué se hace con ellos.
 *
 * - `purged`: se borran al purgar la cuenta de su dueño.
 * - `third-party`: son datos de OTRAS personas (el teléfono de un proveedor, de
 *   un integrante de la cuadrilla) que cargó una Empresa. No son de quien tiene
 *   la cuenta: los administra la Empresa mientras exista.
 */
export const PERSONAL_FIELDS: Record<string, Record<string, 'purged' | 'third-party'>> = {
  CrewMember: { phone: 'third-party' },
  Organization: { contactEmail: 'purged', contactPhone: 'purged' },
  OrganizationMember: { phone: 'purged' },
  // Referencia de una transferencia de la obra: dato del negocio de la Empresa.
  Payment: { reference: 'third-party' },
  Provider: { phone: 'third-party', email: 'third-party' },
  SubscriptionPayment: { bank: 'purged', reference: 'purged', payerId: 'purged' },
  User: { email: 'purged', picture: 'purged' },
};

export interface AccountPurgeRun {
  checked: number;
  purged: number;
  failed: number;
}

/**
 * Las cuentas que ya cumplieron la retención.
 *
 * Se cuenta desde `deactivated_at`. Una cuenta que quedó `inactive` por un
 * camino que no lo puso (a mano en la base, o antes de que el modelo lo
 * completara solo) se cuenta desde `updatedAt`: una cuenta dada de baja casi
 * no se vuelve a tocar, así que es una buena aproximación, y la alternativa
 * —no purgarla nunca— incumple la Política.
 */
export function expiredAccountsFilter(now: Date) {
  const cutoff = new Date(now.getTime() - ACCOUNT_PURGE_RETENTION_DAYS * DAY_MS);
  return {
    account_status: 'inactive',
    purgedAt: { $exists: false },
    $or: [
      { deactivated_at: { $lte: cutoff } },
      { deactivated_at: null, updatedAt: { $lte: cutoff } },
    ],
  };
}

export async function purgeExpiredAccounts(now = new Date()): Promise<AccountPurgeRun> {
  const expired = await User.find(expiredAccountsFilter(now)).select('_id email name');
  const run: AccountPurgeRun = { checked: expired.length, purged: 0, failed: 0 };

  for (const user of expired) {
    try {
      await purgeAccount({ id: String(user._id), email: user.email, name: user.name }, now);
      run.purged += 1;
    } catch (error) {
      run.failed += 1;
      console.error(`❌ [ACCOUNT-PURGE] ${String(user._id)}:`, error);
    }
  }

  return run;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Cierra el cliente de Stripe: ahí viven su email y su nombre, y borrarlo
 * cancela lo que tuviera activo. Si Stripe ya no lo conoce (404) está hecho; si
 * el entorno no tiene Stripe, no hay nada que borrar.
 */
async function deleteStripeCustomer(customerId: string): Promise<void> {
  try {
    await stripeRequest('DELETE', `/customers/${encodeURIComponent(customerId)}`);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) return;
    if (error instanceof StripeApiError && error.status === 404) return;
    throw error;
  }
}

/**
 * Borra los datos personales de UNA cuenta. Cada paso es idempotente y el
 * `User` va al final: si algo falla antes, la cuenta no queda marcada
 * (`purgedAt`) y se reintenta mañana sin haber perdido el hilo para encontrarla.
 *
 * Lo primero son las cosas de afuera —los archivos y Stripe—, que no se
 * pueden recuperar si se pierde la fila que las referencia.
 *
 * El documento `User` no se borra: obras, cobros y gastos que firmó lo
 * referencian. Lo que se conserva (montos, fechas, historial de quién hizo
 * qué) queda atado a «Cuenta eliminada», sin nombre, correo ni contacto.
 */
export async function purgeAccount(
  user: { id: string; email: string; name: string },
  now = new Date(),
): Promise<void> {
  const { id } = user;
  const email = user.email.trim().toLowerCase();

  // Empresas: las que sólo tenían a esta persona dejan de existir como alguien;
  // las que siguen con otros integrantes continúan, y sólo se les saca lo suyo.
  const memberships = await OrganizationMember.find({ user: id }).lean();
  const soleOrganizations: unknown[] = [];
  const sharedOrganizations: unknown[] = [];
  for (const { organization } of memberships) {
    const others = await OrganizationMember.countDocuments({
      organization,
      user: { $ne: id },
    });
    (others === 0 ? soleOrganizations : sharedOrganizations).push(organization);
  }

  const ownPayments = {
    $or: [{ submittedBy: id }, { organization: { $in: soleOrganizations } }],
  };

  // 1. Afuera: comprobantes de pago y cliente de Stripe.
  const withReceipt = await SubscriptionPayment.find({
    ...ownPayments,
    receipt: { $ne: null },
  }).lean();
  for (const payment of withReceipt) {
    if (payment.receipt?.key) await deleteObject(payment.receipt.key);
  }

  const billed = await Subscription.find({
    organization: { $in: soleOrganizations },
    stripeCustomerId: { $ne: null },
  }).lean();
  for (const subscription of billed) {
    if (subscription.stripeCustomerId) await deleteStripeCustomer(subscription.stripeCustomerId);
  }

  // 2. Dónde figuraba su nombre como responsable de una tarea. Hay que
  //    calcular sus obras ANTES de borrar sus accesos.
  const projectIds = [
    ...(await ProjectMembership.find({ user: id }).distinct('project')),
    ...(await Project.find({ createdBy: id }).distinct('_id')),
  ];
  await Activity.updateMany({ 'responsible.user': id }, { $set: { 'responsible.name': PURGED_NAME } });
  if (user.name.trim()) {
    // El responsable también se guarda sólo por nombre, sin referencia. Se
    // reemplaza el nombre exacto dentro de sus obras: es lo más preciso que se
    // puede hacer sin una referencia.
    await Activity.updateMany(
      {
        project: { $in: projectIds },
        'responsible.user': null,
        'responsible.name': { $regex: `^${escapeRegex(user.name.trim())}$`, $options: 'i' },
      },
      { $set: { 'responsible.name': PURGED_NAME } },
    );
  }

  // 3. Lo suyo en las Empresas y los pagos de la suscripción.
  await SubscriptionPayment.updateMany(ownPayments, {
    $set: { bank: null, reference: null, payerId: null, receipt: null },
  });
  await Subscription.updateMany(
    { organization: { $in: soleOrganizations } },
    { $set: { stripeCustomerId: null, stripeSubscriptionId: null, stripeStatus: null } },
  );
  await Organization.updateMany(
    { _id: { $in: soleOrganizations } },
    { $set: { name: PURGED_ORGANIZATION_NAME }, $unset: { contactEmail: '', contactPhone: '' } },
  );
  await Organization.updateMany(
    { _id: { $in: sharedOrganizations }, contactEmail: email },
    { $unset: { contactEmail: '' } },
  );
  await OrganizationMember.updateMany({ user: id }, { $unset: { phone: '' } });

  // 4. Su bandeja y sus accesos: ya no puede entrar, no hay a quién mostrárselos.
  await Notification.deleteMany({ user: id });
  await ProjectMembership.deleteMany({ user: id });
  await ProjectClient.deleteMany({ user: id });

  // 5. Al final, la cuenta. Hasta acá, `purgedAt` sin poner = se reintenta.
  await User.updateOne(
    { _id: id },
    {
      $set: {
        email: purgedEmail(id),
        name: PURGED_NAME,
        email_verified: false,
        enabled: false,
        purgedAt: now,
      },
      $unset: {
        picture: '',
        password: '',
        resetToken: '',
        resetTokenExpires: '',
        emailVerificationToken: '',
        emailVerificationTokenExpires: '',
        pendingEmail: '',
        emailChangeToken: '',
        emailChangeTokenExpires: '',
        termsAcceptedIp: '',
        termsAcceptedUserAgent: '',
      },
    },
  );
}
