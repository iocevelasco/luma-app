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

/**
 * El id de la Empresa que este usuario **es dueño**, o `null` si por algún
 * motivo no tiene. Filtra por `role: 'owner'` a propósito: desde que un
 * Asistente de Obra puede ser `member` de la Empresa de otra persona, un
 * mismo usuario tiene más de una fila en `OrganizationMember`, y un
 * `findOne` sin filtro devolvía cualquiera de las dos sin garantía de orden.
 */
export async function findMyOrganizationId(userId: string): Promise<string | null> {
  const membership = await OrganizationMember.findOne({ user: userId, role: 'owner' }).select(
    'organization',
  );
  return membership ? String(membership.organization) : null;
}
