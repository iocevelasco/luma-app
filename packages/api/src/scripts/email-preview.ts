/**
 * Guarda cada mail de Luma como `.html`, con datos de ejemplo, para revisar
 * el diseño en el navegador sin mandar nada.
 *
 *   pnpm --filter @luma/api email:preview          → packages/api/email-previews/
 *   EMAIL_PREVIEW_DIR=/tmp/mails pnpm --filter @luma/api email:preview
 *
 * No toca la base ni Resend.
 */
import { resolve } from 'node:path';

process.env.EMAIL_PREVIEW_DIR = resolve(process.env.EMAIL_PREVIEW_DIR ?? 'email-previews');

const { EmailService, sendCampaignEmail } = await import('../services/email.service.js');

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

await EmailService.sendEmailVerificationEmail('ana@ejemplo.com', 'token-de-ejemplo', 'Ana Pérez');
await EmailService.sendAccountActivationEmail('beto@ejemplo.com', 'token-de-ejemplo', 'Beto', {
  inviterName: 'Ana Pérez',
  projectName: 'Casa Pérez — Remodelación cocina',
  role: 'supervisor',
});
await EmailService.sendPasswordResetEmail('ana@ejemplo.com', 'token-de-ejemplo');
await EmailService.sendEmailChangeConfirmationEmail('ana.nueva@ejemplo.com', 'token-de-ejemplo', 'Ana Pérez');
await EmailService.sendProjectInvitation({
  to: 'carla@ejemplo.com',
  name: 'Carla',
  inviterName: 'Ana Pérez',
  projectName: 'Casa Pérez — Remodelación cocina',
  projectId: '000000000000000000000001',
  role: 'cliente',
});
await EmailService.sendTeamInvitation({
  to: 'dario@ejemplo.com',
  name: 'Darío',
  inviterName: 'Ana Pérez',
  organizationName: 'Estudio Pérez',
  staffRole: 'contador',
});
const link = '/admin/proyectos/000000000000000000000001/hitos';
await EmailService.sendProjectNotification({
  to: 'ana@ejemplo.com',
  name: 'Ana',
  type: 'actividad_en_revision',
  projectName: 'Casa Pérez — Remodelación cocina',
  subjectName: 'Instalación eléctrica de la cocina',
  link: '/admin/proyectos/000000000000000000000001/actividades',
});
await EmailService.sendProjectNotification({
  to: 'ana@ejemplo.com',
  name: 'Ana',
  type: 'eventualidad',
  projectName: 'Casa Pérez — Remodelación cocina',
  subjectName: 'Fisura en la losa del baño',
  link,
});
await EmailService.sendProjectNotification({
  to: 'carla@ejemplo.com',
  name: 'Carla',
  type: 'hito',
  projectName: 'Casa Pérez — Remodelación cocina',
  subjectName: 'Terminamos la demolición',
  link,
});
await EmailService.sendSubscriptionPaymentApproved('ana@ejemplo.com', 'Ana', inDays(30));
await EmailService.sendSubscriptionPaymentRejected('ana@ejemplo.com', 'Ana', 'La referencia no aparece en el banco.');
await EmailService.sendSubscriptionPaymentToReview('admin@ejemplo.com', {
  organization: 'Estudio Pérez',
  owner: 'Ana Pérez',
  amountBs: 'Bs 34.391,20',
  totalUsd: 'USD 39',
  mismatch: false,
});
await EmailService.sendTrialEnding('ana@ejemplo.com', 'Ana', 3, inDays(3));
await EmailService.sendSubscriptionExpired('ana@ejemplo.com', 'Ana');
await EmailService.sendCardPaymentFailed('ana@ejemplo.com', 'Ana');

console.log(`\n✅ Listo: abrí los .html de ${process.env.EMAIL_PREVIEW_DIR}`);
await sendCampaignEmail({
  to: 'ana@ejemplo.com',
  name: 'Ana',
  title: 'Novedades de Luma',
  body: 'Ya podés registrar tus gastos con foto.\n\nProbalo desde la obra y contanos qué te parece.',
  imageUrl: null,
  unsubscribeUrl: 'https://luma.app/api/public/unsubscribe?u=1&s=firma',
});
