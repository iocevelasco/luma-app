import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

/**
 * Sumar a alguien al equipo: el nombre y la función viajan, el nombre sólo
 * crea cuentas nuevas (nunca pisa la de alguien que ya existe) y la función
 * queda en la fila de la Empresa — no en el usuario, que puede trabajar con
 * varias.
 */
vi.mock('../../models/Organization.js', () => ({ Organization: {} }));
vi.mock('../../models/OrganizationMember.js', () => ({
  OrganizationMember: { create: vi.fn(), exists: vi.fn(), find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../../models/User.js', () => ({
  User: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn(), findByIdAndUpdate: vi.fn() },
}));
vi.mock('../../models/Project.js', () => ({ Project: { find: vi.fn() } }));
vi.mock('../../models/ProjectMembership.js', () => ({ ProjectMembership: { deleteMany: vi.fn() } }));
vi.mock('../../services/organization.service.js', () => ({
  findMyOrganizationId: vi.fn(),
  createPersonalOrganization: vi.fn(),
}));
vi.mock('../../services/email.service.js', () => ({
  EmailService: { sendAccountActivationEmail: vi.fn() },
}));
vi.mock('../../controllers/auth.controller.js', () => ({
  ACTIVATION_TOKEN_TTL_MS: 1000,
  randomToken: () => 'token',
}));

const { OrganizationMember } = await import('../../models/OrganizationMember.js');
const { User } = await import('../../models/User.js');
const { findMyOrganizationId, createPersonalOrganization } = await import(
  '../../services/organization.service.js'
);
const { EmailService } = await import('../../services/email.service.js');
const { inviteMember, updateMember } = await import('../../controllers/organization.controller.js');

function mockRes() {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const createdAt = new Date('2026-10-12T10:00:00.000Z');

describe('inviteMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findMyOrganizationId).mockResolvedValue('org-1' as never);
    vi.mocked(User.findById).mockResolvedValue({ email: 'dueno@empresa.com' } as never);
    // Mongoose devuelve el documento con lo que se le pasó: la fila lleva la función.
    vi.mocked(OrganizationMember.create).mockImplementation((async (doc: object) => ({
      _id: 'row-1',
      createdAt,
      ...doc,
    })) as never);
  });

  it('crea la cuenta con el nombre que se cargó y guarda la función en la fila', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null as never);
    vi.mocked(User.create).mockResolvedValue({
      _id: 'user-9',
      email: 'ana@estudio.com',
      name: 'Ana Pérez',
      email_verified: false,
    } as never);
    const res = mockRes();

    await inviteMember(
      {
        user: { sub: 'owner-1' },
        body: { email: 'ana@estudio.com', name: 'Ana Pérez', staffRole: 'contador' },
      } as never,
      res,
    );

    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ana Pérez' }));
    expect(createPersonalOrganization).toHaveBeenCalledWith('user-9', 'Ana Pérez');
    expect(EmailService.sendAccountActivationEmail).toHaveBeenCalledWith(
      'ana@estudio.com',
      'token',
      'Ana Pérez',
    );
    expect(OrganizationMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'member', staffRole: 'contador' }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { member: { name: string; staffRole: string } };
    };
    expect(body.data.member).toMatchObject({ name: 'Ana Pérez', staffRole: 'contador' });
  });

  it('si la cuenta ya existe no le pisa el nombre ni le manda otro mail de activación', async () => {
    vi.mocked(User.findOne).mockResolvedValue({
      _id: 'user-2',
      email: 'ana@estudio.com',
      name: 'Ana P.',
      email_verified: true,
    } as never);
    vi.mocked(OrganizationMember.exists).mockResolvedValue(null as never);
    const res = mockRes();

    await inviteMember(
      {
        user: { sub: 'owner-1' },
        body: { email: 'ana@estudio.com', name: 'Otro Nombre', staffRole: 'supervisor' },
      } as never,
      res,
    );

    expect(User.create).not.toHaveBeenCalled();
    expect(EmailService.sendAccountActivationEmail).not.toHaveBeenCalled();
    const body = vi.mocked(res.json).mock.calls[0]![0] as { data: { member: { name: string } } };
    expect(body.data.member.name).toBe('Ana P.');
  });

  it('guarda el teléfono en la fila de la Empresa y no en la cuenta', async () => {
    vi.mocked(User.findOne).mockResolvedValue(null as never);
    vi.mocked(User.create).mockResolvedValue({
      _id: 'user-9',
      email: 'ana@estudio.com',
      name: 'Ana Pérez',
      email_verified: false,
    } as never);
    const res = mockRes();

    await inviteMember(
      {
        user: { sub: 'owner-1' },
        body: {
          email: 'ana@estudio.com',
          name: 'Ana Pérez',
          staffRole: 'contador',
          phone: '+54 11 5555 0000',
        },
      } as never,
      res,
    );

    expect(OrganizationMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+54 11 5555 0000' }),
    );
    expect(User.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ phone: expect.anything() }),
    );
    const body = vi.mocked(res.json).mock.calls[0]![0] as { data: { member: { phone: string } } };
    expect(body.data.member.phone).toBe('+54 11 5555 0000');
  });

  it('400 sin función: no hay default que la adivine', async () => {
    const res = mockRes();

    await inviteMember(
      { user: { sub: 'owner-1' }, body: { email: 'ana@estudio.com', name: 'Ana' } } as never,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(OrganizationMember.create).not.toHaveBeenCalled();
  });
});

describe('updateMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(findMyOrganizationId).mockResolvedValue('org-1' as never);
  });

  function setup(row: Record<string, unknown>) {
    vi.mocked(OrganizationMember.findOne).mockResolvedValue(row as never);
    vi.mocked(User.findByIdAndUpdate).mockResolvedValue({
      _id: 'user-2',
      email: 'ana@estudio.com',
      name: 'Ana',
      email_verified: true,
    } as never);
  }

  it('cambia la función y la devuelve', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    setup({ _id: 'row-1', user: 'user-2', staffRole: 'supervisor', createdAt, save });
    const res = mockRes();

    await updateMember(
      {
        user: { sub: 'owner-1' },
        params: { memberId: 'row-1' },
        body: { name: 'Ana', staffRole: 'contador' },
      } as never,
      res,
    );

    expect(save).toHaveBeenCalled();
    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { member: { staffRole: string } };
    };
    expect(body.data.member.staffRole).toBe('contador');
  });

  it('sin función en el body no toca la que tenía', async () => {
    const save = vi.fn();
    setup({ _id: 'row-1', user: 'user-2', staffRole: 'supervisor', createdAt, save });
    const res = mockRes();

    await updateMember(
      {
        user: { sub: 'owner-1' },
        params: { memberId: 'row-1' },
        body: { name: 'Ana' },
      } as never,
      res,
    );

    expect(save).not.toHaveBeenCalled();
    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { member: { staffRole: string } };
    };
    expect(body.data.member.staffRole).toBe('supervisor');
  });

  it('cambia el teléfono y lo devuelve', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    setup({ _id: 'row-1', user: 'user-2', staffRole: 'supervisor', createdAt, save });
    const res = mockRes();

    await updateMember(
      {
        user: { sub: 'owner-1' },
        params: { memberId: 'row-1' },
        body: { name: 'Ana', phone: '11 4444 3333' },
      } as never,
      res,
    );

    expect(save).toHaveBeenCalled();
    const body = vi.mocked(res.json).mock.calls[0]![0] as { data: { member: { phone: string } } };
    expect(body.data.member.phone).toBe('11 4444 3333');
  });

  it('un teléfono vacío lo borra', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    setup({ _id: 'row-1', user: 'user-2', phone: '11 4444 3333', createdAt, save });
    const res = mockRes();

    await updateMember(
      {
        user: { sub: 'owner-1' },
        params: { memberId: 'row-1' },
        body: { name: 'Ana', phone: '' },
      } as never,
      res,
    );

    expect(save).toHaveBeenCalled();
    const body = vi.mocked(res.json).mock.calls[0]![0] as {
      data: { member: { phone?: string } };
    };
    expect(body.data.member.phone).toBeUndefined();
  });

  it('sin teléfono en el body no toca el que tenía', async () => {
    const save = vi.fn();
    setup({ _id: 'row-1', user: 'user-2', phone: '11 4444 3333', createdAt, save });
    const res = mockRes();

    await updateMember(
      {
        user: { sub: 'owner-1' },
        params: { memberId: 'row-1' },
        body: { name: 'Ana' },
      } as never,
      res,
    );

    expect(save).not.toHaveBeenCalled();
    const body = vi.mocked(res.json).mock.calls[0]![0] as { data: { member: { phone: string } } };
    expect(body.data.member.phone).toBe('11 4444 3333');
  });
});
