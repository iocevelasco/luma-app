import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny } from 'zod';

/**
 * Valida el body con un schema de `@luma/shared` y REEMPLAZA `req.body` por el
 * resultado parseado.
 *
 * Lo segundo es lo que importa: a partir de acá el controlador trabaja con
 * datos ya coercionados y con defaults aplicados, no con lo que mandó el
 * cliente.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    Object.assign(req.query, result.data);
    next();
  };
}
