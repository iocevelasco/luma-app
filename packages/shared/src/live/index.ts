/**
 * Tiempo real de obra: el contrato entre el canal SSE de la API y la SPA.
 *
 * El canal **no transporta datos**. Avisa "cambió esto en esta obra" y la
 * pantalla vuelve a pedirlo por la API de siempre, que es la que decide qué
 * ve cada rol. Así nada de plata ni de personas viaja por el stream, y la
 * autorización de la lectura sigue en un solo lugar.
 *
 * Hoy sólo Actividades y Materiales van en vivo; el resto de la obra se
 * refresca por polling (ver `docs/adr/002-tiempo-real-por-obra.md`). Sumar un
 * recurso es: agregarlo a `LIVE_RESOURCES`, decir qué capacidad lo lee y qué
 * escrituras lo afectan. Los tipos obligan a lo primero y un test a lo segundo.
 */

import type { Capability } from '../permissions/index.js';

/** Versión del formato de los eventos. Un cliente viejo ignora lo que no entiende. */
export const LIVE_PROTOCOL_VERSION = 1 as const;

/** Lo que se puede invalidar en vivo. */
export const LIVE_RESOURCES = ['activities', 'materials'] as const;

export type LiveResource = (typeof LIVE_RESOURCES)[number];

export function isLiveResource(value: unknown): value is LiveResource {
  return typeof value === 'string' && (LIVE_RESOURCES as readonly string[]).includes(value);
}

/**
 * La capacidad de **lectura** que hace falta para enterarse de que algo cambió.
 *
 * Aunque el evento no lleve datos, "hubo un cambio en compras" ya es
 * información: una conexión que no podría leer el recurso no lo recibe. Es la
 * misma celda de la grilla que ya gatea el `GET`, así que si el cliente pierde
 * `purchasesVisibleToClient`, deja de recibir `materials` sin tocar nada acá.
 */
export const LIVE_RESOURCE_READ_CAPABILITY: Record<LiveResource, Capability> = {
  activities: 'activity.read',
  materials: 'material.read',
};

/**
 * Qué recursos cambia cada capacidad de **escritura**. La API publica con esto
 * cuando una ruta que la exige responde 2xx: no hay que acordarse de avisar en
 * cada controller, y una ruta futura que declare su capacidad entra sola.
 *
 * Borrar una actividad (`activity.plan`) también mueve Materiales: los
 * materiales cuelgan de una tarea y la lista cruza con ella.
 *
 * La factura de un material (`material.invoice.write`) además crea un gasto,
 * pero Gastos no va en vivo —lo ven dos roles—; se corrige con el polling.
 */
export const LIVE_WRITE_EFFECTS: Partial<Record<Capability, readonly LiveResource[]>> = {
  'activity.create': ['activities'],
  'activity.plan': ['activities', 'materials'],
  'activity.report': ['activities'],
  'activity.review': ['activities'],
  'activity.evidence.write': ['activities'],
  'material.write': ['materials'],
  'material.invoice.write': ['materials'],
};

/** Lo que cambió al ejercer una capacidad. Vacío si no afecta nada en vivo. */
export function liveResourcesForCapability(capability: Capability): readonly LiveResource[] {
  return LIVE_WRITE_EFFECTS[capability] ?? [];
}

/** ¿Estas capacidades alcanzan para enterarse de un cambio en este recurso? */
export function canReceiveLiveResource(
  capabilities: ReadonlySet<Capability> | readonly Capability[],
  resource: LiveResource,
): boolean {
  const needed = LIVE_RESOURCE_READ_CAPABILITY[resource];
  return Array.isArray(capabilities)
    ? (capabilities as readonly Capability[]).includes(needed)
    : (capabilities as ReadonlySet<Capability>).has(needed);
}

/**
 * Nombres de los eventos del stream (`event:` de SSE).
 *
 * - `ready`: la conexión quedó abierta y autorizada.
 * - `invalidate`: algo cambió; ver `LiveInvalidateEvent`.
 * - `ping`: latido. Es un evento de verdad y no un comentario `:`, porque el
 *   cliente lo usa para saber que la conexión sigue viva y un comentario no
 *   llega a la aplicación.
 * - `bye`: el servidor cierra a propósito; el cliente reconecta.
 */
export type LiveEventName = 'ready' | 'invalidate' | 'ping' | 'bye';

export interface LiveReadyEvent {
  v: typeof LIVE_PROTOCOL_VERSION;
  /** Cada cuánto manda el servidor un `ping`. El cliente reconecta si pasa bastante más sin saber de él. */
  heartbeatMs: number;
}

/**
 * Sin ids de entidades, sin nombres, sin montos y sin quién lo hizo: sólo
 * dónde. Quién actuó vive en las notificaciones, con su propia visibilidad.
 */
export interface LiveInvalidateEvent {
  v: typeof LIVE_PROTOCOL_VERSION;
  projectId: string;
  resources: LiveResource[];
  /** ISO 8601 del momento en que el servidor lo emitió. */
  at: string;
}

/** Por qué cierra el servidor. Ninguno es un error: el cliente reconecta y vuelve a pedir. */
export type LiveByeReason =
  /** Tope de vida de la conexión: obliga a revalidar el acceso. */
  | 'lifetime'
  /** Cambió quién puede qué en la obra (miembros, roles, flags, papelera). */
  | 'access-changed'
  /** El servidor se reinicia (deploy). */
  | 'shutdown'
  /** La misma persona abrió demasiadas conexiones; se cierra la más vieja. */
  | 'superseded'
  /** El cliente no lee lo bastante rápido. */
  | 'slow';

export interface LiveByeEvent {
  v: typeof LIVE_PROTOCOL_VERSION;
  reason: LiveByeReason;
}

/** Ruta del stream, relativa a la base de la API. */
export function liveStreamPath(projectId: string): string {
  return `/api/projects/${projectId}/live`;
}
