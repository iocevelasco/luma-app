import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { capabilitiesInProject, type ProjectRole } from '@luma/shared';
import { LiveHub, type LiveHubConfig, type LiveSink } from '../../services/live-hub.service.js';

/**
 * El hub es lo que decide a quién se le avisa de qué: qué se manda, a quién,
 * cuándo y con qué límites. Se prueba con sockets falsos y reloj falso; la
 * conexión real (headers, Traefik, iPhone) es de la prueba de entorno.
 */
vi.mock('../../config/app.config.js', () => ({ LIVE_CONFIG: {} }));

const CONFIG: LiveHubConfig = {
  MAX_CONNECTIONS: 3,
  MAX_CONNECTIONS_PER_USER: 2,
  HEARTBEAT_MS: 20_000,
  MAX_LIFETIME_MS: 600_000,
  COALESCE_MS: 100,
  MAX_BUFFERED_BYTES: 1024,
};

interface FakeSink extends LiveSink {
  chunks: string[];
  ended: boolean;
  destroyed: boolean;
  buffered: number;
}

function fakeSink(): FakeSink {
  const sink = {
    chunks: [] as string[],
    ended: false,
    destroyed: false,
    buffered: 0,
    write(chunk: string) {
      sink.chunks.push(chunk);
      return true;
    },
    end() {
      sink.ended = true;
    },
    destroy() {
      sink.destroyed = true;
    },
    get writableLength() {
      return sink.buffered;
    },
    get writableEnded() {
      return sink.ended;
    },
  };
  return sink;
}

/** Los eventos que recibió, sin el `ready` de la apertura. */
function events(sink: FakeSink): { event: string; data: Record<string, unknown> }[] {
  return sink.chunks
    .map((chunk) => {
      const [eventLine, dataLine] = chunk.split('\n');
      return {
        event: eventLine.replace('event: ', ''),
        data: JSON.parse(dataLine.replace('data: ', '')) as Record<string, unknown>,
      };
    })
    .filter((e) => e.event !== 'ready');
}

function caps(role: ProjectRole, purchasesVisibleToClient = false) {
  return capabilitiesInProject(role, { providersVisibleToClient: false, purchasesVisibleToClient });
}

function connect(hub: LiveHub, userId: string, projectId: string, role: ProjectRole, purchases = false) {
  const sink = fakeSink();
  const handle = hub.open({ userId, projectId, capabilities: caps(role, purchases), sink });
  return { sink, handle };
}

describe('LiveHub', () => {
  let hub: LiveHub;

  beforeEach(() => {
    vi.useFakeTimers();
    hub = new LiveHub(CONFIG);
  });

  afterEach(() => {
    hub.closeAll('shutdown');
    vi.useRealTimers();
  });

  it('al abrir manda `ready` con el latido', () => {
    const { sink } = connect(hub, 'u1', 'p1', 'supervisor');
    expect(sink.chunks[0]).toBe('event: ready\ndata: {"v":1,"heartbeatMs":20000}\n\n');
  });

  it('avisa a los conectados de la obra qué recurso cambió, sin datos de negocio', () => {
    const { sink } = connect(hub, 'u1', 'p1', 'supervisor');

    hub.publish('p1', ['materials']);
    vi.advanceTimersByTime(CONFIG.COALESCE_MS);

    const [invalidate] = events(sink);
    expect(invalidate.event).toBe('invalidate');
    expect(invalidate.data).toMatchObject({ v: 1, projectId: 'p1', resources: ['materials'] });
    // Sólo dónde: nada de ids de entidades ni de quién lo hizo.
    expect(Object.keys(invalidate.data).sort()).toEqual(['at', 'projectId', 'resources', 'v']);
  });

  it('no avisa a otra obra', () => {
    const mine = connect(hub, 'u1', 'p1', 'supervisor');
    const other = connect(hub, 'u2', 'p2', 'supervisor');

    hub.publish('p1', ['activities']);
    vi.advanceTimersByTime(CONFIG.COALESCE_MS);

    expect(events(mine.sink)).toHaveLength(1);
    expect(events(other.sink)).toHaveLength(0);
  });

  it('junta una ráfaga en un solo aviso', () => {
    const { sink } = connect(hub, 'u1', 'p1', 'gerente');

    hub.publish('p1', ['activities']);
    hub.publish('p1', ['materials']);
    hub.publish('p1', ['activities']);
    vi.advanceTimersByTime(CONFIG.COALESCE_MS);

    const received = events(sink);
    expect(received).toHaveLength(1);
    expect(received[0].data.resources).toEqual(['activities', 'materials']);
  });

  it('filtra por capacidad de lectura: el cliente sin compras abiertas no se entera de Materiales', () => {
    const cliente = connect(hub, 'c1', 'p1', 'cliente', false);
    const abierto = connect(hub, 'c2', 'p1', 'cliente', true);

    hub.publish('p1', ['materials']);
    vi.advanceTimersByTime(CONFIG.COALESCE_MS);

    expect(events(cliente.sink)).toHaveLength(0);
    expect(events(abierto.sink)).toHaveLength(1);
  });

  it('entrega a cada uno sólo los recursos que puede leer', () => {
    const cliente = connect(hub, 'c1', 'p1', 'cliente', false);

    hub.publish('p1', ['activities', 'materials']);
    vi.advanceTimersByTime(CONFIG.COALESCE_MS);

    expect(events(cliente.sink)[0].data.resources).toEqual(['activities']);
  });

  it('sin nadie conectado, publicar no deja nada pendiente', () => {
    hub.publish('p1', ['activities']);
    const { sink } = connect(hub, 'u1', 'p1', 'gerente');
    vi.advanceTimersByTime(CONFIG.COALESCE_MS * 2);

    expect(events(sink)).toHaveLength(0);
  });

  it('manda un latido cada HEARTBEAT_MS', () => {
    const { sink } = connect(hub, 'u1', 'p1', 'gerente');

    vi.advanceTimersByTime(CONFIG.HEARTBEAT_MS * 2);

    expect(events(sink).filter((e) => e.event === 'ping')).toHaveLength(2);
  });

  it('cierra con `bye: lifetime` al vencer la vida de la conexión', () => {
    const { sink } = connect(hub, 'u1', 'p1', 'gerente');

    // Hasta +10 % de jitter.
    vi.advanceTimersByTime(CONFIG.MAX_LIFETIME_MS * 1.1 + CONFIG.HEARTBEAT_MS);

    expect(sink.ended).toBe(true);
    expect(events(sink).at(-1)).toMatchObject({ event: 'bye', data: { reason: 'lifetime' } });
    expect(hub.stats().connections).toBe(0);
  });

  it('con el máximo por persona abierto, cierra la más vieja y no la nueva', () => {
    const first = connect(hub, 'u1', 'p1', 'gerente');
    const second = connect(hub, 'u1', 'p1', 'gerente');
    const third = connect(hub, 'u1', 'p1', 'gerente');

    expect(first.sink.ended).toBe(true);
    expect(events(first.sink).at(-1)).toMatchObject({ event: 'bye', data: { reason: 'superseded' } });
    expect(second.sink.ended).toBe(false);
    expect(third.sink.ended).toBe(false);
    expect(hub.stats().connections).toBe(2);
  });

  it('el tope global se consulta antes de abrir', () => {
    connect(hub, 'u1', 'p1', 'gerente');
    connect(hub, 'u2', 'p1', 'gerente');
    expect(hub.hasRoom()).toBe(true);
    connect(hub, 'u3', 'p1', 'gerente');
    expect(hub.hasRoom()).toBe(false);
  });

  it('cierra a quien no vacía lo que se le manda', () => {
    const { sink } = connect(hub, 'u1', 'p1', 'gerente');
    sink.buffered = CONFIG.MAX_BUFFERED_BYTES + 1;

    hub.publish('p1', ['activities']);
    vi.advanceTimersByTime(CONFIG.COALESCE_MS);

    expect(sink.destroyed).toBe(true);
    expect(hub.stats().connections).toBe(0);
  });

  it('closeProject corta a todos los de la obra y a nadie más', () => {
    const a = connect(hub, 'u1', 'p1', 'supervisor');
    const b = connect(hub, 'u2', 'p1', 'cliente');
    const other = connect(hub, 'u3', 'p2', 'supervisor');

    hub.closeProject('p1', 'access-changed');

    expect(a.sink.ended).toBe(true);
    expect(b.sink.ended).toBe(true);
    expect(events(a.sink).at(-1)).toMatchObject({ event: 'bye', data: { reason: 'access-changed' } });
    expect(other.sink.ended).toBe(false);
  });

  it('un aviso pendiente de una obra cerrada no sale', () => {
    const { sink } = connect(hub, 'u1', 'p1', 'gerente');
    hub.publish('p1', ['activities']);

    hub.closeProject('p1', 'access-changed');
    vi.advanceTimersByTime(CONFIG.COALESCE_MS);

    expect(events(sink).map((e) => e.event)).toEqual(['bye']);
  });

  it('release libera el lugar y es idempotente', () => {
    const { handle } = connect(hub, 'u1', 'p1', 'gerente');
    handle.release();
    handle.release();
    expect(hub.stats().connections).toBe(0);
  });

  it('closeAll avisa a todos (deploy)', () => {
    const a = connect(hub, 'u1', 'p1', 'gerente');
    const b = connect(hub, 'u2', 'p2', 'gerente');

    hub.closeAll('shutdown');

    for (const { sink } of [a, b]) {
      expect(sink.ended).toBe(true);
      expect(events(sink).at(-1)).toMatchObject({ event: 'bye', data: { reason: 'shutdown' } });
    }
    expect(hub.stats()).toEqual({ connections: 0, projects: 0, users: 0 });
  });

  it('un socket que ya se cerró no rompe el aviso al resto', () => {
    const dead = connect(hub, 'u1', 'p1', 'gerente');
    const alive = connect(hub, 'u2', 'p1', 'gerente');
    dead.sink.write = () => {
      throw new Error('socket cerrado');
    };

    hub.publish('p1', ['activities']);
    vi.advanceTimersByTime(CONFIG.COALESCE_MS);

    expect(events(alive.sink)).toHaveLength(1);
    expect(hub.stats().connections).toBe(1);
  });

  it('un socket que ya estaba destruido no queda registrado contando contra los límites', () => {
    const { sink } = connect(hub, 'u1', 'p1', 'gerente');
    // El cliente se fue: escribirle no falla, pero tampoco llega a nadie.
    sink.destroyed = true;

    vi.advanceTimersByTime(CONFIG.HEARTBEAT_MS);

    expect(hub.stats().connections).toBe(0);
  });
});
