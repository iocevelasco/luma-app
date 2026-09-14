import { Organization } from '../models/Organization.js';
import { OrganizationMember } from '../models/OrganizationMember.js';

/**
 * Todo usuario nuevo tiene su empresa personal desde que existe, se haya
 * registrado solo (`register()`) o llegado como cliente invitado
 * (`inviteClient()`) — así nunca hace falta preguntar "¿tenés empresa?" antes
 * de dejarlo crear su primera obra.
 */
export async function createPersonalOrganization(userId: string, name: string) {
  const organization = await Organization.create({ name });
  await OrganizationMember.create({ organization: organization._id, user: userId, role: 'owner' });
  return organization;
}

/** El id de la empresa de este usuario, o `null` si por algún motivo no tiene. */
export async function findMyOrganizationId(userId: string): Promise<string | null> {
  const membership = await OrganizationMember.findOne({ user: userId }).select('organization');
  return membership ? String(membership.organization) : null;
}
