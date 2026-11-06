import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { capabilitiesInProject, type ProjectRole } from '@luma/shared';

/**
 * Lo que el controller del stream tiene que cuidar: no abrir para quien ya no
 * tiene cuenta activa, no abrir para quien no tiene nada que escuchar, respetar
 * el tope y apagarse con el interruptor. El stream real es de la prueba de entorno.
 */
const liveConfig = vi.hoisted(() => ({ ENABLED: true }));
vi.mock('../../config/app.config.js', () => ({ LIVE_CONFIG: liveConfig }));
vi.mock('../../models/User.js', () => ({ User: { findById: vi.fn() } }));
vi.mock('../../services/live-hub.service.js', () => ({
  liveHub: { hasRoom: vi.fn(), open: vi.fn() },
}));

const { User } = await import('../../models/User.js');
const { liveHub } = await import('../../services/live-hub.service.js');
const { streamProjectLive } = await import('../../controllers/live.controller.js');

function activeUser(overrides: Record<string, unknown> = {}) {
  return { select: vi.fn().mockResolvedValue({ enabled: true, account_status: 'active', ...overrides }) };
}

function run(role: ProjectRole = 'supervisor') {
  const res = {
    status: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
    flushHeaders: vi.fn(),
    once: vi.fn(),
    destroyed: false,
    socket: { destroyed: false },
  } as unknown as Response;
  const req = {
    user: { sub: 'u-1' },
    project: { _id: 'p-1' },
    projectCapabilities: capabilitiesInProject(role, { providersVisibleToClient: false }),
    socket: { setTimeout: vi.fn(), setNoDelay: vi.fn(), setKeepAlive: vi.fn() },
    once: vi.fn(),
    destroyed: false,
  } as unknown as Request;
  const next = vi.fn();
  return { req, res, next };
}

describe('streamProjectLive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveConfig.ENABLED = true;
    vi.mocked(User.findById).mockReturnValue(activeUser() as never);
    vi.mocked(liveHub.hasRoom).mockReturnValue(true);
    vi.mocked(liveHub.open).mockReturnValue({ id: 1, release: vi.fn() });
  });

  it('abre el stream con los headers que evitan buffering y lo registra en el hub', async () => {
    const { req, res, next } = run('supervisor');

    await streamProjectLive(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      }),
    );
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(liveHub.open).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-1', projectId: 'p-1', sink: res }),
    );
    // Se libera el lugar cuando el cliente se va. Sólo por el `close` de la
    // respuesta: el del request significa otra cosa desde Node 16.
    expect(res.once).toHaveBeenCalledWith('close', expect.any(Function));
    expect(req.once).not.toHaveBeenCalled();
  });

  it('503 si el canal está apagado por entorno', async () => {
    liveConfig.ENABLED = false;
    const { req, res, next } = run();

    await streamProjectLive(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }));
    expect(liveHub.open).not.toHaveBeenCalled();
  });

  it.each([
    ['dada de baja', { enabled: false, account_status: 'inactive' }],
    ['sin habilitar', { enabled: false }],
    ['inactiva', { account_status: 'inactive' }],
  ])('401 si la cuenta está %s, aunque el token todavía valga', async (_label, overrides) => {
    vi.mocked(User.findById).mockReturnValue(activeUser(overrides) as never);
    const { req, res, next } = run();

    await streamProjectLive(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
    expect(liveHub.open).not.toHaveBeenCalled();
  });

  it('401 si la cuenta ya no existe', async () => {
    vi.mocked(User.findById).mockReturnValue({ select: vi.fn().mockResolvedValue(null) } as never);
    const { req, res, next } = run();

    await streamProjectLive(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'UNAUTHENTICATED' }));
  });

  it('204 para un rol sin nada que escuchar (contador): no abre conexión', async () => {
    const { req, res, next } = run('contador');

    await streamProjectLive(req, res, next);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(liveHub.open).not.toHaveBeenCalled();
  });

  it('503 si el proceso ya llegó al tope de conexiones', async () => {
    vi.mocked(liveHub.hasRoom).mockReturnValue(false);
    const { req, res, next } = run();

    await streamProjectLive(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: 'SERVICE_UNAVAILABLE' }));
    expect(res.flushHeaders).not.toHaveBeenCalled();
    expect(liveHub.open).not.toHaveBeenCalled();
  });

  it('si el cliente se fue mientras se resolvía el acceso, no registra una conexión fantasma', async () => {
    const { req, res, next } = run();
    (res as { destroyed: boolean }).destroyed = true;

    await streamProjectLive(req, res, next);

    expect(liveHub.open).not.toHaveBeenCalled();
    expect(res.flushHeaders).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('si el socket de la respuesta ya se cerró, tampoco registra la conexión', async () => {
    const { req, res, next } = run();
    (res.socket as { destroyed: boolean }).destroyed = true;

    await streamProjectLive(req, res, next);

    expect(liveHub.open).not.toHaveBeenCalled();
  });

  // Desde Node 16 el request se autodestruye cuando terminó de llegar, con la
  // conexión viva. Salir sin contestar en ese caso dejaría el pedido colgado.
  it('un request ya consumido (`req.destroyed`) con la conexión viva igual abre el stream', async () => {
    const { req, res, next } = run();
    (req as { destroyed: boolean }).destroyed = true;

    await streamProjectLive(req, res, next);

    expect(res.flushHeaders).toHaveBeenCalled();
    expect(liveHub.open).toHaveBeenCalled();
  });
});
