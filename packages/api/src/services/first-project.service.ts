import { classifyAccount, type ProjectRole } from '@luma/shared';
import { OrganizationMember } from '../models/OrganizationMember.js';
import { ProjectMembership } from '../models/ProjectMembership.js';
import { User } from '../models/User.js';
import { TEST_ACCOUNT } from './platform-users.service.js';
import { statesFor } from './subscription.service.js';

/**
 * ¿Hay que llevar a esta persona derecho a crear su primera obra?
 *
 * Sí sólo a quien llegó a **gestionar la suya**: la cuenta que se clasifica `noProject`
 * en el censo de plataforma (`classifyAccount`, `@luma/shared`) y no tiene ninguna obra.
 * No a quien llegó a participar en la de otro (empleado, cliente), ni a quien ya tiene
 * membresía —aunque se le haya vencido o se le hayan purgado las obras: su botón de
 * "Nueva obra" lleva a pagar—, ni a las cuentas de prueba y de baja.
 *
 * Se calcula al pedir y no se guarda: el segmento cambia en cuanto la persona crea su
 * primera obra (eso arranca la prueba). Es la misma regla del censo, para que "a quién
 * seguimos" y "a quién empujamos" no diverjan.
 */
export async function firstProjectPrompt(userId: string, projectCount: number): Promise<boolean> {
  // Con obras a la vista no hay nada que empujar: se ahorra el resto de las lecturas.
  if (projectCount > 0) return false;

  const [user, owners, roles] = await Promise.all([
    User.findById(userId).select('email account_status').lean(),
    OrganizationMember.find({ user: userId, role: 'owner' }).select('organization').lean(),
    ProjectMembership.find({ user: userId }).distinct('role') as Promise<ProjectRole[]>,
  ]);
  if (!user) return false;

  const states = await statesFor(owners.map((owner) => owner.organization));
  // Con varias Empresas cuenta la primera iniciada, igual que en el censo.
  const statuses = owners
    .map((owner) => states.get(String(owner.organization))?.status)
    .filter((status) => status !== undefined);
  const subscriptionStatus =
    statuses.find((status) => status !== 'sin_iniciar') ?? statuses[0] ?? null;

  return (
    classifyAccount({
      isTest: TEST_ACCOUNT.test(user.email),
      active: user.account_status === 'active',
      subscriptionStatus,
      projectRoles: roles,
    }) === 'noProject'
  );
}
