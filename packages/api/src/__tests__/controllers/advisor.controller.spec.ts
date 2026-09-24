import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

/**
 * Cubre lo que no depende de pegarle a la API real de Claude: sin
 * `ANTHROPIC_API_KEY` el endpoint responde 503 en vez de intentar la llamada,
 * y un body inválido nunca llega al servicio. El servicio en sí (tool use
 * contra Claude) no se testea acá — necesita una key real y plata real, es
 * responsabilidad del POC manual, no de CI.
 */
const { ENABLED } = vi.hoisted(() => ({ ENABLED: { value: false } }));

vi.mock('../../config/app.config.js', () => ({
  ANTHROPIC_CONFIG: {
    get ENABLED() {
      return ENABLED.value;
    },
    API_KEY: undefined,
    MODEL: 'claude-sonnet-5',
  },
}));

vi.mock('../../services/project-advisor.service.js', () => ({
  askProjectAdvisor: vi.fn(),
}));

const { askProjectAdvisor } = await import('../../services/project-advisor.service.js');
const { sendProjectAdvisorMessage } = await import('../../controllers/advisor.controller.js');

function mockRes(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    project: { _id: 'project-1' },
    body: { message: '¿Cómo viene el cronograma?', ...overrides },
  } as unknown as Request;
}

describe('sendProjectAdvisorMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ENABLED.value = false;
  });

  it('503 si no hay ANTHROPIC_API_KEY configurada', async () => {
    const req = mockReq();
    const res = mockRes();

    await sendProjectAdvisorMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(askProjectAdvisor).not.toHaveBeenCalled();
  });

  it('400 si el mensaje está vacío', async () => {
    ENABLED.value = true;
    const req = mockReq({ message: '' });
    const res = mockRes();

    await sendProjectAdvisorMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(askProjectAdvisor).not.toHaveBeenCalled();
  });

  it('400 si el historial tiene un role inválido', async () => {
    ENABLED.value = true;
    const req = mockReq({ history: [{ role: 'system', content: 'algo' }] });
    const res = mockRes();

    await sendProjectAdvisorMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(askProjectAdvisor).not.toHaveBeenCalled();
  });

  it('200 con la respuesta del servicio, scoped al project de req.project', async () => {
    ENABLED.value = true;
    vi.mocked(askProjectAdvisor).mockResolvedValue('Hay dos actividades atrasadas.');
    const req = mockReq();
    const res = mockRes();

    await sendProjectAdvisorMessage(req, res);

    expect(askProjectAdvisor).toHaveBeenCalledWith('project-1', '¿Cómo viene el cronograma?', []);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { reply: 'Hay dos actividades atrasadas.' },
    });
  });

  it('502 si el servicio de IA falla', async () => {
    ENABLED.value = true;
    vi.mocked(askProjectAdvisor).mockRejectedValue(new Error('timeout'));
    const req = mockReq();
    const res = mockRes();

    await sendProjectAdvisorMessage(req, res);

    expect(res.status).toHaveBeenCalledWith(502);
  });
});
