import type { NextFunction, Request, Response } from 'express';
import { errorCodeForStatus, type ApiErrorCode } from '@luma/shared';
import { isProduction } from '../config/app.config.js';

/**
 * Garantiza que toda respuesta de error salga con `code`, la mande quien la
 * mande.
 *
 * El `errorHandler` sólo ve lo que se **lanza**. Pero hay 221 lugares en los
 * controllers que arman la respuesta a mano con `res.status(...).json(...)`,
 * y esos nunca pasan por ahí. Migrarlos todos de una es un cambio enorme y
 * arriesgado; mientras tanto el frontend no puede confiar en que `code`
 * exista, y sin esa garantía no sirve de nada.
 *
 * Esto envuelve `res.json` y completa lo que falte. El resultado es que el
 * contrato ya vale hoy para toda la API, y migrar cada controller a `throw
 * notFound(...)` pasa a ser una mejora de prolijidad y no un prerrequisito.
 *
 * Hace una segunda cosa, y es la que más importa: **impide que un 5xx cuente
 * qué pasó adentro**. Dieciséis controllers responden sus 500 con el mensaje
 * del error, que en un fallo de Mongoose trae la consulta, el nombre de la
 * colección y a veces el valor que chocó. Acá se reemplaza por uno genérico
 * y el real queda en el log.
 *
 * Que esto viva en un middleware y no en una regla de lint es deliberado: una
 * regla avisa y se puede ignorar; esto no se puede saltear desde un
 * controller.
 *
 * Va **antes** de las rutas en el pipeline de `index.ts`: tiene que envolver
 * `res.json` antes de que cualquier handler lo llame.
 */
export function normalizeErrors(_req: Request, res: Response, next: NextFunction) {
  const original = res.json.bind(res);

  res.json = function patched(body: unknown) {
    if (!isErrorEnvelope(body)) return original(body);

    const normalized: ErrorEnvelope = {
      ...body,
      code: body.code ?? inferCode(res.statusCode, body),
    };

    if (res.statusCode >= 500) {
      // El mensaje real ya se vio en el log del controller; afuera no sale.
      // En desarrollo se deja, que es donde sirve para no ir al log.
      if (isProduction) normalized.error = GENERIC_SERVER_ERROR;
      else console.error('❌ [API]', res.statusCode, body.error);
    }

    return original(normalized);
  };

  next();
}

const GENERIC_SERVER_ERROR = 'Algo falló de nuestro lado. Probá de nuevo en un momento.';

interface ErrorEnvelope {
  success: false;
  error?: unknown;
  code?: unknown;
  details?: unknown;
}

function isErrorEnvelope(body: unknown): body is ErrorEnvelope {
  return typeof body === 'object' && body !== null && (body as { success?: unknown }).success === false;
}

/**
 * El código sale del status. Con una excepción: un 400 que trae `details` es
 * casi siempre un fallo de validación de Zod, y marcarlo como tal deja al
 * formulario resaltar el campo en vez de mostrar un cartel genérico.
 */
function inferCode(status: number, body: ErrorEnvelope): ApiErrorCode {
  if (status === 400 && body.details !== undefined) return 'VALIDATION';
  return errorCodeForStatus(status);
}
