import { useEffect, useState } from 'react';

/** Milisegundos entre una letra y la siguiente. */
const STEP_MS = 55;
/** Pausa antes de empezar a escribir, para que el panel termine de abrirse. */
const START_DELAY_MS = 350;

/** `matchMedia` falta en algunos entornos: se detecta, no se asume. */
function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Escribe `text` letra por letra, una sola vez. Con `enabled` en falso (o con
 * movimiento reducido) devuelve el texto completo, sin animación. Devuelve el
 * trozo visible y si todavía está escribiendo, para poner el cursor.
 */
export function useTypewriter(text: string, enabled = true): { visible: string; typing: boolean } {
  const animate = enabled && !prefersReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!animate) return;
    setCount(0);
    let timer = 0;
    const tick = (next: number) => {
      setCount(next);
      if (next < text.length) timer = window.setTimeout(() => tick(next + 1), STEP_MS);
    };
    timer = window.setTimeout(() => tick(1), START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [animate, text]);

  if (!animate) return { visible: text, typing: false };
  return { visible: text.slice(0, count), typing: count < text.length };
}
