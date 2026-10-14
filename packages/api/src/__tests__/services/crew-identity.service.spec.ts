import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El guardia de duplicados: qué cuenta como la misma persona y qué no. Es la
 * regla que hace que un obrero exista una sola vez en la Empresa.
 */
vi.mock('../../models/CrewMember.js', () => ({ CrewMember: { find: vi.fn() } }));
vi.mock('../../models/ProjectCrewMember.js', () => ({ ProjectCrewMember: { exists: vi.fn() } }));

const { CrewMember } = await import('../../models/CrewMember.js');
const { ProjectCrewMember } = await import('../../models/ProjectCrewMember.js');
const { assertNoCrewDuplicate, findCrewDuplicate } = await import(
  '../../services/crew-identity.service.js'
);

function member(overrides: Record<string, unknown>) {
  return {
    _id: 'crew-1',
    name: 'Juan Pérez',
    kind: 'persona',
    isLead: false,
    active: true,
    scope: 'organization',
    project: null,
    ...overrides,
  };
}

function mockOrganization(members: unknown[]) {
  vi.mocked(CrewMember.find).mockReturnValue({
    select: vi.fn().mockResolvedValue(members),
  } as never);
}

describe('findCrewDuplicate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProjectCrewMember.exists).mockResolvedValue(null as never);
  });

  it('el mismo nombre sin tilde ni mayúsculas es un duplicado', async () => {
    mockOrganization([member({})]);

    const duplicate = await findCrewDuplicate('org-1', { name: 'juan  perez', kind: 'persona' });

    expect(duplicate).toMatchObject({ reason: 'name', existing: { id: 'crew-1' } });
  });

  it('con "es otra persona" el nombre ya no bloquea', async () => {
    mockOrganization([member({})]);

    const duplicate = await findCrewDuplicate('org-1', {
      name: 'Juan Pérez',
      kind: 'persona',
      allowDuplicateName: true,
    });

    expect(duplicate).toBeNull();
  });

  it('el mismo teléfono bloquea aunque el nombre sea otro, y no se puede saltear', async () => {
    mockOrganization([member({ name: 'J. Pérez', phone: '+54 11 5555-5555' })]);

    const duplicate = await findCrewDuplicate('org-1', {
      name: 'Juancito',
      phone: '54 11 5555 5555',
      kind: 'persona',
      allowDuplicateName: true,
    });

    expect(duplicate).toMatchObject({ reason: 'phone', existing: { name: 'J. Pérez' } });
  });

  it('un equipo con el teléfono de su encargado no choca con él', async () => {
    mockOrganization([member({ phone: '1155555555' })]);

    const duplicate = await findCrewDuplicate('org-1', {
      name: 'Cuadrilla de Juan',
      phone: '1155555555',
      kind: 'equipo',
    });

    expect(duplicate).toBeNull();
  });

  it('encuentra a los dados de baja: se reactivan, no se recrean', async () => {
    mockOrganization([member({ active: false })]);

    const duplicate = await findCrewDuplicate('org-1', { name: 'Juan Pérez', kind: 'persona' });

    expect(duplicate?.existing.active).toBe(false);
  });

  it('si hay uno activo y otro dado de baja, ofrece el activo', async () => {
    mockOrganization([
      member({ _id: 'old', active: false }),
      member({ _id: 'current', active: true }),
    ]);

    const duplicate = await findCrewDuplicate('org-1', { name: 'Juan Pérez', kind: 'persona' });

    expect(duplicate?.existing.id).toBe('current');
  });

  it('avisa si ya está en la obra desde la que se intentó el alta', async () => {
    mockOrganization([member({})]);
    vi.mocked(ProjectCrewMember.exists).mockResolvedValue({ _id: 'link' } as never);

    const duplicate = await findCrewDuplicate(
      'org-1',
      { name: 'Juan Pérez', kind: 'persona' },
      'project-1',
    );

    expect(duplicate?.alreadyInProject).toBe(true);
  });

  it('no mira los privados de otras obras: desde acá no se podrían sumar', async () => {
    mockOrganization([]);

    await findCrewDuplicate('org-1', { name: 'Juan', kind: 'persona' }, 'project-1');

    expect(CrewMember.find).toHaveBeenCalledWith({
      organization: 'org-1',
      $or: [{ scope: { $ne: 'project' } }, { project: 'project-1' }],
    });
  });

  it('un empleado viejo sin `kind` cuenta como persona', async () => {
    mockOrganization([member({ kind: undefined })]);

    const duplicate = await findCrewDuplicate('org-1', { name: 'Juan Pérez', kind: 'persona' });

    expect(duplicate?.existing).toMatchObject({ id: 'crew-1', kind: 'persona' });
  });

  it('el "sólo para esta obra" de ESTA obra cuenta como que ya está acá', async () => {
    mockOrganization([member({ scope: 'project', project: 'project-1' })]);

    const duplicate = await findCrewDuplicate(
      'org-1',
      { name: 'Juan Pérez', kind: 'persona' },
      'project-1',
    );

    expect(duplicate?.alreadyInProject).toBe(true);
    expect(ProjectCrewMember.exists).not.toHaveBeenCalled();
  });

  it('un teléfono de menos de 6 dígitos no identifica a nadie', async () => {
    mockOrganization([member({ name: 'Otro', phone: '0' })]);

    const duplicate = await findCrewDuplicate('org-1', {
      name: 'Juan Pérez',
      phone: '0',
      kind: 'persona',
    });

    expect(duplicate).toBeNull();
  });
});

describe('assertNoCrewDuplicate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lanza un CONFLICT con la persona existente en `details`', async () => {
    mockOrganization([member({})]);

    await expect(
      assertNoCrewDuplicate('org-1', { name: 'Juan Pérez', kind: 'persona' }),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      details: { reason: 'name', existing: { id: 'crew-1', name: 'Juan Pérez', active: true } },
    });
  });

  it('a un dado de baja que sigue vinculado a la obra lo nombra como dado de baja', async () => {
    // "Ya está en esta obra" dejaría a la persona sin pista: no aparece en
    // ninguna lista. El mensaje tiene que decir por qué no la ve.
    mockOrganization([member({ active: false })]);
    vi.mocked(ProjectCrewMember.exists).mockResolvedValue({ _id: 'link' } as never);

    await expect(
      assertNoCrewDuplicate('org-1', { name: 'Juan Pérez', kind: 'persona' }, 'project-1'),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/dado de baja/),
      details: { alreadyInProject: true, existing: { active: false } },
    });
  });

  it('un homónimo que ya está en la obra se nombra como homónimo', async () => {
    mockOrganization([member({})]);
    vi.mocked(ProjectCrewMember.exists).mockResolvedValue({ _id: 'link' } as never);

    await expect(
      assertNoCrewDuplicate('org-1', { name: 'Juan Pérez', kind: 'persona' }, 'project-1'),
    ).rejects.toMatchObject({ message: 'Ya hay alguien llamado Juan Pérez en esta obra.' });
  });

  it('no lanza si no hay nadie parecido', async () => {
    mockOrganization([member({ name: 'María Gómez' })]);

    await expect(
      assertNoCrewDuplicate('org-1', { name: 'Juan Pérez', kind: 'persona' }),
    ).resolves.toBeUndefined();
  });
});
