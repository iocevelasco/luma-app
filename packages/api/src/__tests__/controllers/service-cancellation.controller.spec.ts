import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * La baja pública guarda el pedido y avisa. No toca la cuenta: borrarla aquí
 * saltaría el plazo de 90 días de la Política de Privacidad.
 */
vi.mock('../../models/ServiceCancellation.js', () => ({
  ServiceCancellation: { create: vi.fn() },
}));
vi.mock('../../models/User.js', () => ({
  User: { find: vi.fn(), deleteOne: vi.fn(), deleteMany: vi.fn() },
}));
vi.mock('../../services/email.service.js', () => ({
  EmailService: { sendServiceCancellation: vi.fn() },
}));

const { ServiceCancellation } = await import('../../models/ServiceCancellation.js');
const { User } = await import('../../models/User.js');
const { EmailService } = await import('../../services/email.service.js');
const { submitServiceCancellation } = await import('../../controllers/service-cancellation.controller.js');

function response() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

const complete = {
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@estudio.com',
  phone: '04141234567',
  nationalId: 'V-12345678',
  reason: 'privacy',
  additionalInfo: 'Quiero cerrar la cuenta.',
  confirmed: true,
};

describe('solicitud de baja', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ServiceCancellation.create).mockResolvedValue({} as never);
    vi.mocked(User.find).mockReturnValue({
      select: vi.fn().mockResolvedValue([{ email: 'admin@luma.test' }]),
    } as never);
    vi.mocked(EmailService.sendServiceCancellation).mockResolvedValue(true);
  });

  it('guarda el pedido y avisa al admin, sin borrar la cuenta', async () => {
    const res = response();
    await submitServiceCancellation({ body: complete } as Request, res as unknown as Response);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true });
    expect(ServiceCancellation.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@estudio.com', reason: 'privacy', confirmed: true }),
    );
    expect(EmailService.sendServiceCancellation).toHaveBeenCalledWith(
      'admin@luma.test',
      expect.objectContaining({ email: 'ana@estudio.com', reason: 'Privacidad' }),
    );
    expect(User.deleteOne).not.toHaveBeenCalled();
    expect(User.deleteMany).not.toHaveBeenCalled();
  });

  it('rechaza el formulario incompleto y no guarda nada', async () => {
    const res = response();
    await expect(
      submitServiceCancellation({ body: { ...complete, email: 'no-es-correo', confirmed: false } } as Request, res as unknown as Response),
    ).rejects.toMatchObject({ status: 400 });
    expect(ServiceCancellation.create).not.toHaveBeenCalled();
  });
});
