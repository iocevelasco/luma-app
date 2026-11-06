import type { LiveResource } from '@luma/shared';

/**
 * Junta los avisos de tiempo real antes de tocar la caché.
 *
 * Tres razones para no invalidar en cuanto llega cada aviso:
 *
 * 1. **Ráfagas**: una importación o un "marcar varias" manda varios avisos
 *    seguidos. Una ventana corta los junta y se pide una vez.
 * 2. **Tormenta**: si diez personas miran la misma obra, un cambio haría que
 *    las diez pidan en el mismo milisegundo. El jitter las reparte.
 * 3. **No pisar lo que la persona está haciendo**: mientras hay una mutación
 *    en curso en esta pestaña (arrastrar una tarjeta, guardar un formulario),
 *    un refetch devolvería el estado del servidor *sin* ese cambio y la
 *    pantalla saltaría hacia atrás. Se espera a que termine; la mutación ya
 *    invalida por su cuenta al terminar. Con un tope, para no quedar
 *    esperando para siempre.
 */

export interface InvalidationBatcherOptions {
  /** Qué hacer con los recursos juntados: invalidar sus queries. */
  flush: (resources: readonly LiveResource[]) => void;
  /** ¿Hay una mutación en curso en esta pestaña? */
  isBusy: () => boolean;
  /** Ventana en que se juntan avisos. */
  windowMs?: number;
  /** Jitter máximo que se suma a la ventana. */
  jitterMs?: number;
  /** Cuánto se espera como máximo a que termine una mutación. */
  maxBusyWaitMs?: number;
  /** Cada cuánto se vuelve a mirar si la mutación terminó. */
  busyRecheckMs?: number;
  random?: () => number;
}

export interface InvalidationBatcher {
  add(resources: readonly LiveResource[]): void;
  /** Descarta lo pendiente (al desmontar o cambiar de obra). */
  cancel(): void;
}

export function createInvalidationBatcher(options: InvalidationBatcherOptions): InvalidationBatcher {
  const {
    flush,
    isBusy,
    windowMs = 250,
    jitterMs = 750,
    maxBusyWaitMs = 5_000,
    busyRecheckMs = 300,
    random = Math.random,
  } = options;

  const pending = new Set<LiveResource>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let firstDeferredAt: number | null = null;

  function schedule(delay: number) {
    timer = setTimeout(run, delay);
  }

  function run() {
    timer = null;

    if (isBusy()) {
      firstDeferredAt ??= Date.now();
      if (Date.now() - firstDeferredAt < maxBusyWaitMs) {
        schedule(busyRecheckMs);
        return;
      }
    }

    firstDeferredAt = null;
    const resources = [...pending];
    pending.clear();
    if (resources.length > 0) flush(resources);
  }

  return {
    add(resources) {
      for (const resource of resources) pending.add(resource);
      // Una sola ventana abierta a la vez: los avisos que llegan adentro se suman.
      if (!timer) schedule(windowMs + Math.round(random() * jitterMs));
    },

    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
      firstDeferredAt = null;
      pending.clear();
    },
  };
}
