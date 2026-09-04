import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Envuelve un handler async para que una promesa rechazada llegue al
 * errorHandler.
 *
 * Express 4 no captura rechazos de promesas: sin esto, un `await` que falla
 * deja el request colgado hasta el timeout y no loguea nada.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
