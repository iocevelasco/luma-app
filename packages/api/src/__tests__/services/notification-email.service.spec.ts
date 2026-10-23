import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../models/User.js', () => ({ User: { find: vi.fn() } }));
vi.mock('../../services/email.service.js', () => ({
  EmailService: { sendProjectNotification: vi.fn() },
}));

const { User } = await import('../../models/User.js');
const { EmailService } = await import('../../services/email.service.js');
const { emailProjectNotification } = await import('../../services/notification-email.service.js');

function mockUsers(rows: { email: string; name: string }[]) {
  vi.mocked(User.find).mockReturnValue({ select: vi.fn().mockResolvedValue(rows) } as never);
}

const params = {
  recipientIds: ['u1', 'u2'],
  type: 'hito' as const,
  projectName: 'Casa Pérez',
  subjectName: 'Losa terminada',
  link: '/admin/proyectos/p1/hitos',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('emailProjectNotification', () => {
  it('manda un mail por persona y cuenta los que salieron', async () => {
    mockUsers([
      { email: 'ana@x.com', name: 'Ana' },
      { email: 'beto@x.com', name: 'Beto' },
    ]);
    vi.mocked(EmailService.sendProjectNotification).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(emailProjectNotification(params)).resolves.toBe(1);
    expect(EmailService.sendProjectNotification).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'ana@x.com', name: 'Ana', type: 'hito', projectName: 'Casa Pérez' }),
    );
  });

  it('sólo a cuentas activas y con el correo confirmado', async () => {
    mockUsers([]);

    await emailProjectNotification(params);

    expect(User.find).toHaveBeenCalledWith({
      _id: { $in: ['u1', 'u2'] },
      email_verified: true,
      enabled: { $ne: false },
    });
  });

  it('un tipo que no va por mail no consulta ni manda nada', async () => {
    await expect(emailProjectNotification({ ...params, type: 'actividad_iniciada' })).resolves.toBe(0);
    expect(User.find).not.toHaveBeenCalled();
  });

  it('si algo falla devuelve 0 y no lanza', async () => {
    vi.mocked(User.find).mockImplementation(() => {
      throw new Error('mongo caído');
    });

    await expect(emailProjectNotification(params)).resolves.toBe(0);
  });
});
