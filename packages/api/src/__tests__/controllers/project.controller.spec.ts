import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

/**
 * El listado de obras trae, por cada una, el rol de quien pregunta y sus
 * capacidades ya resueltas: es lo que le permite a la Empresa saber en qué
 * obras puede dar acceso sin abrirlas una por una ni derivarlo del rol.
 */
vi.mock('../../models/User.js', () => ({
  User: {
    findById: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
    exists: vi.fn(),
  },
}));
vi.mock('../../models/Project.js', () => ({ Project: { find: vi.fn(), create: vi.fn() } }));
vi.mock('../../services/subscription.service.js', () => ({
  statesFor: vi.fn(),
  decideProjectCreation: vi.fn(),
}));
vi.mock('../../services/project-deletion.service.js', () => ({
  removedProjectsForMember: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../models/ProjectMembership.js', () => ({
  ProjectMembership: {
    find: vi.fn(),
    exists: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    countDocuments: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));
vi.mock('../../services/organization.service.js', () => ({
  findMyOrganizationId: vi.fn(),
  createPersonalOrganization: vi.fn(),
}));
vi.mock('../../services/email.service.js', () => ({
  EmailService: { sendAccountActivationEmail: vi.fn(), sendProjectInvitation: vi.fn() },
}));
vi.mock('../../controllers/auth.controller.js', () => ({
  ACTIVATION_TOKEN_TTL_MS: 1000,
  randomToken: () => 'token',
}));

const { Project } = await import('../../models/Project.js');
const { ProjectMembership } = await import('../../models/ProjectMembership.js');
const { User } = await import('../../models/User.js');
const { EmailService } = await import('../../services/email.service.js');
const { createPersonalOrganization } = await import('../../services/organization.service.js');
const { statesFor, decideProjectCreation } = await import(
  '../../services/subscription.service.js'
);
const { findMyOrganizationId } = await import('../../services/organization.service.js');
const {
  listProjects,
  inviteProjectMember,
  createProject,
  updateProjectMemberRole,
  removeProjectMember,
} = await import('../../controllers/project.controller.js');

/** El estado de la suscripción de `org-1`, como lo devuelve `statesFor`. */
function subscriptionOf(canWrite: boolean) {
  return new Map([
    [
      'org-1',
      {
        status: canWrite ? 'activa' : 'vencida',
        canWrite,
        accessUntil: null,
        trialDaysLeft: null,
      },
    ],
  ]);
}

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function projectDoc(id: string, createdBy: string) {
  const date = new Date('2026-10-12T10:00:00.000Z');
  return {
    _id: id,
    organization: 'org-1',
    createdBy,
    name: `Obra ${id}`,
    description: 'x',
    location: 'CABA',
    estimatedStartDate: '2026-09-01',
    estimatedEndDate: '2026-12-01',
    currency: 'ARS',
    status: 'active',
    providersVisibleToClient: false,
    createdAt: date,
    updatedAt: date,
  };
}

describe('listProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(statesFor).mockResolvedValue(subscriptionOf(true) as never);
  });

  it('con la suscripción de la Empresa dueña vencida, la obra viene en sólo lectura', async () => {
    vi.mocked(statesFor).mockResolvedValue(subscriptionOf(false) as never);
    vi.mocked(ProjectMembership.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(Project.find).mockReturnValue({
      sort: () => ({ limit: () => Promise.resolve([projectDoc('p1', 'user-1')]) }),
    } as never);
    const res = mockRes();

    await listProjects({ user: { sub: 'user-1' } } as never, res);

    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { projects: { readOnly: boolean; capabilities: string[] }[] };
    };
    const item = body.data.projects[0]!;
    expect(item.readOnly).toBe(true);
    expect(item.capabilities).toContain('activity.read');
    expect(item.capabilities.every((c) => c.endsWith('.read'))).toBe(true);
  });

  it('marca gerente a quien creó la obra y le da project.invite', async () => {
    vi.mocked(ProjectMembership.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as never);
    vi.mocked(Project.find).mockReturnValue({
      sort: () => ({ limit: () => Promise.resolve([projectDoc('p1', 'user-1')]) }),
    } as never);
    const res = mockRes();

    await listProjects({ user: { sub: 'user-1' } } as never, res);

    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { projects: { role: string; capabilities: string[] }[] };
    };
    expect(body.data.projects[0]!.role).toBe('gerente');
    expect(body.data.projects[0]!.capabilities).toContain('project.invite');
  });

  it('a un supervisor invitado le devuelve su rol y no le da project.invite', async () => {
    vi.mocked(ProjectMembership.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([{ project: 'p2', role: 'supervisor' }]),
    } as never);
    vi.mocked(Project.find).mockReturnValue({
      sort: () => ({ limit: () => Promise.resolve([projectDoc('p2', 'otro-usuario')]) }),
    } as never);
    const res = mockRes();

    await listProjects({ user: { sub: 'user-1' } } as never, res);

    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { projects: { role: string; capabilities: string[] }[] };
    };
    expect(body.data.projects[0]!.role).toBe('supervisor');
    expect(body.data.projects[0]!.capabilities).not.toContain('project.invite');
  });
});

describe('listProjects: obras eliminadas', () => {
  it('avisa de las obras en la papelera a las que la persona fue invitada', async () => {
    const { removedProjectsForMember } = await import(
      '../../services/project-deletion.service.js'
    );
    vi.mocked(removedProjectsForMember).mockResolvedValueOnce([{ id: 'p9', name: 'Casa Norte' }]);
    vi.mocked(statesFor).mockResolvedValue(new Map() as never);
    vi.mocked(ProjectMembership.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([{ project: 'p9', role: 'cliente' }]),
    } as never);
    vi.mocked(Project.find).mockReturnValue({
      sort: () => ({ limit: () => Promise.resolve([]) }),
    } as never);
    const res = mockRes();

    await listProjects({ user: { sub: 'user-1' } } as never, res);

    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { projects: unknown[]; removedProjects: { id: string; name: string }[] };
    };
    expect(body.data.projects).toEqual([]);
    expect(body.data.removedProjects).toEqual([{ id: 'p9', name: 'Casa Norte' }]);
  });
});

describe('inviteProjectMember: enlace de activación en manos de otra persona', () => {
  const invite = async (existing: Record<string, unknown>) => {
    vi.clearAllMocks();
    vi.mocked(User.findById).mockResolvedValue({ email: 'dueno@empresa.com' } as never);
    vi.mocked(User.findOne).mockResolvedValue({
      _id: 'user-2',
      email: 'ana@estudio.com',
      name: 'ana',
      email_verified: false,
      ...existing,
    } as never);
    vi.mocked(ProjectMembership.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue(null),
    } as never);
    vi.mocked(User.exists).mockResolvedValue(null as never);
    vi.mocked(ProjectMembership.create).mockResolvedValue({
      _id: 'm-1',
      role: 'supervisor',
      createdAt: new Date('2026-10-12T10:00:00.000Z'),
    } as never);
    const res = mockRes();
    await inviteProjectMember(
      {
        user: { sub: 'owner-1' },
        project: { _id: 'p-1', createdBy: 'owner-1' },
        body: { email: 'ana@estudio.com', role: 'supervisor' },
      } as never,
      res,
      vi.fn(),
    );
    return res;
  };

  it('no la suma si el enlace de esa cuenta lo tiene otra persona', async () => {
    const res = await invite({ activationLinkHeldBy: 'owner-OTRO' });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(ProjectMembership.create).not.toHaveBeenCalled();
  });

  it('no la suma si otra persona la activó con ese enlace y nadie probó la casilla', async () => {
    const res = await invite({ claimedViaLinkBy: 'owner-OTRO' });

    expect(res.status).toHaveBeenCalledWith(409);
    expect(ProjectMembership.create).not.toHaveBeenCalled();
  });

  it('quien tiene el enlace sí puede seguir dándole acceso', async () => {
    const res = await invite({ activationLinkHeldBy: 'owner-1' });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(ProjectMembership.create).toHaveBeenCalled();
  });

  it('a quien ya tenía cuenta le avisa por mail que lo sumaron a la obra', async () => {
    const res = await invite({ email_verified: true });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(EmailService.sendAccountActivationEmail).not.toHaveBeenCalled();
    expect(EmailService.sendProjectInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@estudio.com', projectId: 'p-1', role: 'supervisor' }),
    );
  });

  it('si la invitación no se concreta, no manda el aviso', async () => {
    await invite({ activationLinkHeldBy: 'owner-OTRO' });

    expect(EmailService.sendProjectInvitation).not.toHaveBeenCalled();
  });
});

describe('inviteProjectMember: entrega del mail de activación', () => {
  const inviteNew = async () => {
    vi.clearAllMocks();
    vi.mocked(User.findById).mockResolvedValue({ email: 'dueno@empresa.com' } as never);
    vi.mocked(User.findOne).mockResolvedValue(null as never);
    vi.mocked(User.create).mockResolvedValue({
      _id: 'user-9',
      email: 'ana@estudio.com',
      name: 'ana',
      email_verified: false,
    } as never);
    vi.mocked(ProjectMembership.create).mockResolvedValue({
      _id: 'm-1',
      role: 'supervisor',
      createdAt: new Date('2026-10-12T10:00:00.000Z'),
    } as never);
    const res = mockRes();
    await inviteProjectMember(
      {
        user: { sub: 'owner-1' },
        project: { _id: 'p-1', createdBy: 'owner-1' },
        body: { email: 'ana@estudio.com', role: 'supervisor' },
      } as never,
      res,
    );
    return vi.mocked(res.json).mock.calls[0]![0] as {
      data: { emailSent?: boolean; activationUrl?: string };
    };
  };

  it('si el mail no salió, avisa, entrega el enlace y deja asentado quién lo tiene', async () => {
    vi.mocked(EmailService.sendAccountActivationEmail).mockResolvedValue(false);

    const body = await inviteNew();

    expect(createPersonalOrganization).toHaveBeenCalled();
    expect(body.data.emailSent).toBe(false);
    expect(body.data.activationUrl).toMatch(/\/activate\?token=token$/);
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'user-9' },
      { $set: { activationLinkHeldBy: 'owner-1' } },
    );
  });

  it('si el mail salió no entrega el enlace', async () => {
    vi.mocked(EmailService.sendAccountActivationEmail).mockResolvedValue(true);

    const body = await inviteNew();

    expect(body.data.emailSent).toBe(true);
    expect(body.data.activationUrl).toBeUndefined();
    expect(User.updateOne).toHaveBeenCalledWith(
      { _id: 'user-9' },
      { $unset: { activationLinkHeldBy: '' } },
    );
  });
});

describe('gerentes de la obra: el tope de cinco', () => {
  const PROJECT_DOC = { _id: 'p-1', createdBy: 'owner-1', name: 'Obra' };
  const CREATED_AT = new Date('2026-10-12T10:00:00.000Z');

  /** `others` = gerentes con fila además de quien creó la obra, que cuenta uno. */
  function setup({ others, existing = null }: { others: number; existing?: unknown }) {
    vi.clearAllMocks();
    vi.mocked(User.findById).mockResolvedValue({ email: 'dueno@empresa.com' } as never);
    vi.mocked(User.findOne).mockResolvedValue(null as never);
    vi.mocked(User.create).mockResolvedValue({
      _id: 'user-9',
      email: 'ana@estudio.com',
      name: 'ana',
      email_verified: false,
    } as never);
    vi.mocked(User.exists).mockResolvedValue(null as never);
    vi.mocked(EmailService.sendAccountActivationEmail).mockResolvedValue(true);
    vi.mocked(ProjectMembership.findOne).mockReturnValue({
      select: vi.fn().mockResolvedValue(existing),
    } as never);
    vi.mocked(ProjectMembership.countDocuments).mockResolvedValue(others as never);
    vi.mocked(ProjectMembership.create).mockResolvedValue({
      _id: 'm-1',
      role: 'gerente',
      createdAt: CREATED_AT,
    } as never);
  }

  async function invite(role: string) {
    const res = mockRes();
    const next = vi.fn();
    await inviteProjectMember(
      {
        user: { sub: 'owner-1' },
        project: PROJECT_DOC,
        body: { email: 'ana@estudio.com', role },
        can: () => true,
      } as never,
      res,
      next,
    );
    return { res, next };
  }

  it('con lugar, suma al gerente y recién ahí manda el mail de activación', async () => {
    setup({ others: 3 }); // el dueño + 3 = 4 de 5

    const { res } = await invite('gerente');

    expect(res.status).toHaveBeenCalledWith(201);
    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { member: { role: string; manageable: boolean; pending: boolean } };
    };
    expect(body.data.member).toMatchObject({ role: 'gerente', manageable: true, pending: true });
    const createdAt = vi.mocked(ProjectMembership.create).mock.invocationCallOrder[0]!;
    const mailedAt = vi.mocked(EmailService.sendAccountActivationEmail).mock.invocationCallOrder[0]!;
    expect(mailedAt).toBeGreaterThan(createdAt);
  });

  it('con cinco gerentes no crea la cuenta ni la membresía: 409 con el máximo', async () => {
    setup({ others: 4 }); // el dueño + 4 = 5 de 5

    const { res, next } = await invite('gerente');

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 409,
        code: 'CONFLICT',
        message: expect.stringContaining('5 gerentes'),
      }),
    );
    expect(User.create).not.toHaveBeenCalled();
    expect(ProjectMembership.create).not.toHaveBeenCalled();
    expect(EmailService.sendAccountActivationEmail).not.toHaveBeenCalled();
  });

  it('el tope no frena a los demás roles', async () => {
    setup({ others: 4 });

    const { res } = await invite('supervisor');

    expect(res.status).toHaveBeenCalledWith(201);
    expect(ProjectMembership.countDocuments).not.toHaveBeenCalled();
  });

  it('dos invitaciones a la vez: la que se pasa del tope se deshace y no manda mail', async () => {
    setup({ others: 3 });
    // El primer conteo ve lugar; cuando termina de guardar, la otra ya entró.
    vi.mocked(ProjectMembership.countDocuments)
      .mockResolvedValueOnce(3 as never)
      .mockResolvedValueOnce(5 as never);

    const { res, next } = await invite('gerente');

    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
    expect(ProjectMembership.findByIdAndDelete).toHaveBeenCalledWith('m-1');
    expect(EmailService.sendAccountActivationEmail).not.toHaveBeenCalled();
  });

  it('quien ya está con otro rol no se invita de nuevo: dice cuál es', async () => {
    setup({ others: 0, existing: { role: 'supervisor' } });
    vi.mocked(User.findOne).mockResolvedValue({
      _id: 'user-2',
      email: 'ana@estudio.com',
      name: 'ana',
      email_verified: true,
    } as never);

    const { res } = await invite('gerente');

    expect(res.status).toHaveBeenCalledWith(409);
    const body = vi.mocked(res.json).mock.calls[0]![0] as { error: string };
    expect(body.error).toMatch(/ya está en la obra como supervisor/);
    expect(ProjectMembership.create).not.toHaveBeenCalled();
  });

  it('una cuenta dada de baja no se suma a la obra', async () => {
    setup({ others: 0 });
    vi.mocked(User.findOne).mockResolvedValue({
      _id: 'user-2',
      email: 'ana@estudio.com',
      name: 'ana',
      email_verified: true,
      account_status: 'inactive',
    } as never);

    const { res } = await invite('gerente');

    // 400 y no 409: la pantalla de la Empresa lee un 409 como "ya tenía acceso".
    expect(res.status).toHaveBeenCalledWith(400);
    expect(ProjectMembership.create).not.toHaveBeenCalled();
  });

  describe('cambiar el rol y sacar', () => {
    const MEMBERSHIP = (role: string) => ({
      _id: 'm-7',
      user: 'user-7',
      role,
      createdAt: CREATED_AT,
      save: vi.fn(),
    });

    function mockMembership(membership: ReturnType<typeof MEMBERSHIP>) {
      vi.clearAllMocks();
      vi.mocked(ProjectMembership.findOne).mockResolvedValue(membership as never);
      vi.mocked(User.findById).mockReturnValue({
        select: vi.fn().mockResolvedValue({ email: 'x@y.com', name: 'x', email_verified: true }),
      } as never);
      vi.mocked(User.exists).mockResolvedValue({ _id: 'user-7' } as never);
    }

    const requestFor = (can: (capability: string) => boolean, role = 'gerente') =>
      ({
        user: { sub: 'cogerente-1' },
        project: PROJECT_DOC,
        params: { membershipId: 'm-7' },
        body: { role },
        can,
      }) as never;

    it('hacer gerente a un supervisor sin lugar es 409 y no cambia nada', async () => {
      const membership = MEMBERSHIP('supervisor');
      mockMembership(membership);
      vi.mocked(ProjectMembership.countDocuments).mockResolvedValue(4 as never);
      const next = vi.fn();

      await updateProjectMemberRole(requestFor(() => true), mockRes(), next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
      expect(membership.save).not.toHaveBeenCalled();
    });

    it('hacer gerente a un supervisor, con lugar, es de cualquier gerente', async () => {
      const membership = MEMBERSHIP('supervisor');
      mockMembership(membership);
      vi.mocked(ProjectMembership.countDocuments).mockResolvedValue(2 as never);
      const res = mockRes();

      // Puede sumar gente (`project.invite`), no tocar a otros gerentes.
      await updateProjectMemberRole(
        requestFor((capability) => capability === 'project.invite'),
        res,
        vi.fn(),
      );

      expect(membership.role).toBe('gerente');
      expect(membership.save).toHaveBeenCalled();
      expect(vi.mocked(res.json).mock.calls[0]![0]).toMatchObject({
        data: { member: { role: 'gerente', manageable: false } },
      });
    });

    it('bajarle el rol a otro gerente es sólo de quien creó la obra', async () => {
      const membership = MEMBERSHIP('gerente');
      mockMembership(membership);
      const next = vi.fn();

      await updateProjectMemberRole(
        requestFor((capability) => capability === 'project.invite', 'cliente'),
        mockRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: 'FORBIDDEN' }));
      expect(membership.save).not.toHaveBeenCalled();
    });

    it('quien creó la obra sí le baja el rol a otro gerente', async () => {
      const membership = MEMBERSHIP('gerente');
      mockMembership(membership);
      const res = mockRes();

      await updateProjectMemberRole(requestFor(() => true, 'cliente'), res, vi.fn());

      expect(membership.role).toBe('cliente');
      expect(res.json).toHaveBeenCalled();
    });

    it('sacar a otro gerente es sólo de quien creó la obra', async () => {
      mockMembership(MEMBERSHIP('gerente'));
      const next = vi.fn();

      await removeProjectMember(
        requestFor((capability) => capability === 'project.invite'),
        mockRes(),
        next,
      );

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(ProjectMembership.findByIdAndDelete).not.toHaveBeenCalled();
    });

    it('sacar a un supervisor sigue siendo de cualquier gerente', async () => {
      mockMembership(MEMBERSHIP('supervisor'));
      const res = mockRes();

      await removeProjectMember(
        requestFor((capability) => capability === 'project.invite'),
        res,
        vi.fn(),
      );

      expect(ProjectMembership.findByIdAndDelete).toHaveBeenCalledWith('m-7');
      expect(res.json).toHaveBeenCalled();
    });
  });
});

describe('createProject: límites de la suscripción', () => {
  const body = {
    name: 'Baño',
    description: 'Remodelación',
    location: 'Caracas',
    estimatedStartDate: '2026-11-01',
    estimatedEndDate: '2026-12-01',
    currency: 'USD',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findMyOrganizationId).mockResolvedValue('org-1');
  });

  it('en la prueba con 3 activas no crea la cuarta: pasa el error de PAID_PLAN_REQUIRED', async () => {
    vi.mocked(decideProjectCreation).mockResolvedValue({
      allowed: false,
      code: 'PAID_PLAN_REQUIRED',
    });
    const res = mockRes();
    const next = vi.fn();

    await createProject({ user: { sub: 'user-1' }, body } as never, res, next);

    expect(Project.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'PAID_PLAN_REQUIRED', status: 402 }));
  });

  it('vencida no crea nada', async () => {
    vi.mocked(decideProjectCreation).mockResolvedValue({
      allowed: false,
      code: 'SUBSCRIPTION_REQUIRED',
    });
    const next = vi.fn();

    await createProject({ user: { sub: 'user-1' }, body } as never, mockRes(), next);

    expect(Project.create).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'SUBSCRIPTION_REQUIRED' }));
  });

  it('si la suscripción lo permite, la crea en mi Empresa', async () => {
    vi.mocked(decideProjectCreation).mockResolvedValue({
      allowed: true,
      startsTrial: false,
      isExtra: true,
    });
    vi.mocked(Project.create).mockResolvedValue(projectDoc('p9', 'user-1') as never);
    const res = mockRes();

    await createProject({ user: { sub: 'user-1' }, body } as never, res, vi.fn());

    expect(decideProjectCreation).toHaveBeenCalledWith('org-1', 'user-1');
    expect(Project.create).toHaveBeenCalledWith(
      expect.objectContaining({ organization: 'org-1', createdBy: 'user-1' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
