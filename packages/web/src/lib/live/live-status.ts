import { useSyncExternalStore } from 'react';
import type { LiveStatus } from './live-connection';

/**
 * El estado del canal en vivo de la obra abierta, legible desde cualquier hook.
 *
 * Existe para una sola decisión: con el canal sano, el polling de las listas
 * que ya reciben avisos puede espaciarse (ver `polledList`); con el canal
 * caído, vuelve a los 30 s. `off` es "no hay canal": sin obra abierta, o sin
 * sesión.
 */
export type LiveState = LiveStatus | 'off';

let current: LiveState = 'off';
const listeners = new Set<() => void>();

export function setLiveStatus(next: LiveState): void {
  if (next === current) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLiveStatus(): LiveState {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => 'off',
  );
}
