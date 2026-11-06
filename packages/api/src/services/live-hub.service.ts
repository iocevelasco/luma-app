import {
  LIVE_PROTOCOL_VERSION,
  canReceiveLiveResource,
  type Capability,
  type LiveByeEvent,
  type LiveByeReason,
  type LiveEventName,
  type LiveInvalidateEvent,
  type LiveReadyEvent,
  type LiveResource,
} from '@luma/shared';
import { LIVE_CONFIG } from '../config/app.config.js';

/**
 * El hub del tiempo real de obra: quién está conectado a qué obra y a quién
 * avisarle cuando algo cambia.
 *
 * Vive **en la memoria de este proceso**. Es a propósito: hoy hay una sola
 * instancia de la API, y un bus compartido (Redis) sería un servicio más que
 * operar para un caso que no existe. Lo que esto cuesta —un deploy corta todos
 * los streams, y con dos réplicas un cambio hecho en una no llega a la otra— está
 * en `docs/adr/002-tiempo-real-por-obra.md`. Quien publica y quien escucha sólo
 * conocen `publish`/`open`, así que cambiar la implementación no toca a nadie.
 *
 * Lo que el hub garantiza, y por qué:
 * - **Sólo avisa, no entrega datos.** El evento dice qué recurso cambió en qué
 *   obra. Nada de ids, nombres, montos ni quién lo hizo.
 * - **Filtra por capacidad de lectura**, resuelta una vez al abrir la conexión
 *   con la misma grilla que gatea el `GET`. Una conexión que no podría leer el
 *   recurso no se entera de que cambió.
 * - **Junta las ráfagas.** Cincuenta filas importadas son un solo aviso.
 * - **Acota todo**: conexiones por persona y totales, vida máxima de cada una y
 *   buffer por cliente. Un cliente lento se corta, no se espera.
 */

/** Lo mínimo que el hub necesita de la respuesta HTTP. `express.Response` lo cumple. */
export interface LiveSink {
  write(chunk: string): boolean;
  end(): void;
  destroy(): void;
  readonly writableLength: number;
  readonly writableEnded: boolean;
  /** `true` si el socket ya se cerró (el cliente se fue). Escribirle no falla, pero tampoco llega a nadie. */
  readonly destroyed?: boolean;
}

export interface LiveHubConfig {
  MAX_CONNECTIONS: number;
  MAX_CONNECTIONS_PER_USER: number;
  HEARTBEAT_MS: number;
  MAX_LIFETIME_MS: number;
  COALESCE_MS: number;
  MAX_BUFFERED_BYTES: number;
}

export interface LiveHandle {
  readonly id: number;
  /** El cliente se fue (o el stream terminó): deja de recibir y libera el lugar. */
  release(): void;
}

interface Connection {
  id: number;
  userId: string;
  projectId: string;
  capabilities: ReadonlySet<Capability>;
  sink: LiveSink;
  expiresAt: number;
}

interface Pending {
  resources: Set<LiveResource>;
  timer: NodeJS.Timeout;
}

export class LiveHub {
  private readonly connections = new Map<number, Connection>();
  private readonly byProject = new Map<string, Set<Connection>>();
  private readonly pending = new Map<string, Pending>();
  private ticker: NodeJS.Timeout | null = null;
  private nextId = 1;

  constructor(private readonly config: LiveHubConfig = LIVE_CONFIG) {}

  /** ¿Entra otra conexión? Se pregunta antes de contestar 200, para poder contestar 503. */
  hasRoom(): boolean {
    return this.connections.size < this.config.MAX_CONNECTIONS;
  }

  /**
   * Registra una conexión ya autorizada y le manda `ready`.
   *
   * Si la persona ya tiene el máximo abierto, se cierra la **más vieja**: la
   * pestaña nueva es la que está mirando alguien, la vieja suele ser un zombi
   * (iOS deja conexiones muertas sin avisar).
   */
  open(args: {
    userId: string;
    projectId: string;
    capabilities: Iterable<Capability>;
    sink: LiveSink;
  }): LiveHandle {
    const mine = [...this.connections.values()]
      .filter((connection) => connection.userId === args.userId)
      .sort((a, b) => a.id - b.id);
    while (mine.length >= this.config.MAX_CONNECTIONS_PER_USER) {
      this.close(mine.shift()!, 'superseded');
    }

    // ±10 % de vida: si todos abrieran a la vez (un deploy), no vencerían a la vez.
    const lifetime = this.config.MAX_LIFETIME_MS * (0.9 + Math.random() * 0.2);
    const connection: Connection = {
      id: this.nextId++,
      userId: args.userId,
      projectId: args.projectId,
      capabilities: new Set(args.capabilities),
      sink: args.sink,
      expiresAt: Date.now() + lifetime,
    };

    this.connections.set(connection.id, connection);
    let room = this.byProject.get(connection.projectId);
    if (!room) {
      room = new Set();
      this.byProject.set(connection.projectId, room);
    }
    room.add(connection);
    this.ensureTicker();

    const ready: LiveReadyEvent = {
      v: LIVE_PROTOCOL_VERSION,
      heartbeatMs: this.config.HEARTBEAT_MS,
    };
    this.send(connection, 'ready', ready);

    return { id: connection.id, release: () => this.remove(connection) };
  }

  /**
   * Avisa que cambiaron estos recursos en la obra. Barato de llamar: sin nadie
   * conectado no hace nada, y varias llamadas seguidas salen como un solo aviso.
   */
  publish(projectId: string, resources: readonly LiveResource[]): void {
    if (resources.length === 0 || !this.byProject.has(projectId)) return;

    const pending = this.pending.get(projectId);
    if (pending) {
      for (const resource of resources) pending.resources.add(resource);
      return;
    }

    const timer = setTimeout(() => this.flush(projectId), this.config.COALESCE_MS);
    timer.unref();
    this.pending.set(projectId, { resources: new Set(resources), timer });
  }

  /**
   * Cierra todas las conexiones de la obra: cambió quién puede qué (miembros,
   * roles, flags, papelera). Reconectan, y al reconectar se vuelve a autorizar
   * a cada uno — es más simple y más seguro que editar permisos en caliente.
   */
  closeProject(projectId: string, reason: LiveByeReason): void {
    this.dropPending(projectId);
    for (const connection of [...(this.byProject.get(projectId) ?? [])]) {
      this.close(connection, reason);
    }
  }

  /** Cierre ordenado, para el deploy: cada cliente se entera y reconecta. */
  closeAll(reason: LiveByeReason): void {
    for (const projectId of [...this.pending.keys()]) this.dropPending(projectId);
    for (const connection of [...this.connections.values()]) this.close(connection, reason);
  }

  /** Para logs y para decidir si los límites están bien puestos. */
  stats(): { connections: number; projects: number; users: number } {
    return {
      connections: this.connections.size,
      projects: this.byProject.size,
      users: new Set([...this.connections.values()].map((c) => c.userId)).size,
    };
  }

  private flush(projectId: string): void {
    const pending = this.pending.get(projectId);
    this.pending.delete(projectId);
    if (!pending) return;

    for (const connection of [...(this.byProject.get(projectId) ?? [])]) {
      const resources = [...pending.resources].filter((resource) =>
        canReceiveLiveResource(connection.capabilities, resource),
      );
      if (resources.length === 0) continue;

      const event: LiveInvalidateEvent = {
        v: LIVE_PROTOCOL_VERSION,
        projectId,
        resources,
        at: new Date().toISOString(),
      };
      this.send(connection, 'invalidate', event);
    }
  }

  private tick(): void {
    const now = Date.now();
    for (const connection of [...this.connections.values()]) {
      if (now >= connection.expiresAt) {
        this.close(connection, 'lifetime');
      } else {
        this.send(connection, 'ping', { v: LIVE_PROTOCOL_VERSION });
      }
    }
  }

  /** Escribe un evento. Si el cliente no vacía lo que se le manda, se lo corta. */
  private send(connection: Connection, event: LiveEventName, data: object): void {
    const { sink } = connection;
    // Escribir a un socket destruido no lanza: la conexión quedaría registrada,
    // contando contra los límites, hasta que venciera su vida máxima.
    if (sink.writableEnded || sink.destroyed) {
      this.remove(connection);
      return;
    }

    try {
      sink.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.remove(connection);
      return;
    }

    if (sink.writableLength > this.config.MAX_BUFFERED_BYTES) {
      this.remove(connection);
      sink.destroy();
    }
  }

  private close(connection: Connection, reason: LiveByeReason): void {
    const bye: LiveByeEvent = { v: LIVE_PROTOCOL_VERSION, reason };
    this.send(connection, 'bye', bye);
    this.remove(connection);
    try {
      connection.sink.end();
    } catch {
      // Ya estaba cerrada.
    }
  }

  private remove(connection: Connection): void {
    if (!this.connections.delete(connection.id)) return;

    const room = this.byProject.get(connection.projectId);
    room?.delete(connection);
    if (room?.size === 0) {
      this.byProject.delete(connection.projectId);
      this.dropPending(connection.projectId);
    }
    if (this.connections.size === 0 && this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private dropPending(projectId: string): void {
    const pending = this.pending.get(projectId);
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending.delete(projectId);
  }

  private ensureTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.tick(), this.config.HEARTBEAT_MS);
    this.ticker.unref();
  }
}

/** Una sola instancia por proceso. Los tests crean la suya con `new LiveHub(...)`. */
export const liveHub = new LiveHub();
