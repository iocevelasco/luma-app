import compression from 'compression';
import type { Request, Response } from 'express';

/**
 * Qué respuestas se comprimen.
 *
 * El stream de tiempo real (`text/event-stream`) **no**: `compression` retiene
 * los bytes hasta llenar un buffer, y un aviso de dos líneas llegaría tarde o
 * nunca. Con el resto se comporta como siempre (el filtro por defecto).
 *
 * Se decide con el `Content-Type` ya puesto: el filtro corre cuando los
 * headers están por salir, así que el controller del stream tiene que fijarlo
 * antes del primer `write`/`flushHeaders`.
 */
export function compressionFilter(req: Request, res: Response): boolean {
  const type = res.getHeader('Content-Type');
  if (typeof type === 'string' && type.startsWith('text/event-stream')) return false;
  return compression.filter(req, res);
}
