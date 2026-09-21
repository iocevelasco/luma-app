import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cubre el fix de `findMyOrganizationId`: desde que un Asistente de Obra
 * puede tener más de una fila en `OrganizationMember` (la propia como
 * `owner`, la de quien lo invitó como `member`), el filtro por rol deja de
 * ser cosmético — sin él, "mi empresa" podía resolver a la de otro.
 */
vi.mock('../../models/OrganizationMember.js', () => ({
  OrganizationMember: { findOne: vi.fn() },
}));
vi.mock('../../models/Organization.js', () => ({
  Organization: { create: vi.fn() },
}));

const { OrganizationMember } = await import('../../models/OrganizationMember.js');
const { findMyOrganizationId } = await import('../../services/organization.service.js');

describe('findMyOrganizationId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filtra por role: owner', async () => {
    vi.mocked(OrganizationMember.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue({ organization: 'org-mia' }),
    } as never);

    const result = await findMyOrganizationId('user-1');

    expect(OrganizationMember.findOne).toHaveBeenCalledWith({ user: 'user-1', role: 'owner' });
    expect(result).toBe('org-mia');
  });

  it('devuelve null si no es owner de ninguna empresa (sólo member de otra)', async () => {
    vi.mocked(OrganizationMember.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as never);

    const result = await findMyOrganizationId('user-asistente');

    expect(result).toBeNull();
  });
});
