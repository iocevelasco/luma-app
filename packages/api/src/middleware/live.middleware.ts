import type { NextFunction, Request, Response } from 'express';
import { liveResourcesForCapability, type Capability, type LiveByeReason } from '@luma/shared';
import { liveHub } from '../services/live-hub.service.js';

/**
 * Los dos enganches del tiempo real de obra con las rutas HTTP.
 *
 * Los dos esperan a que la respuesta **salga bien** (`finish` y 2xx): un 403 o
 * un 500 no cambió nada y no tiene por qué mover las pantallas de nadie.
 */

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function succeeded(res: Response): boolean {
  return res.statusCode >= 200 && res.statusCode < 300;
}

/**
 * Tras una escritura exitosa, avisa a la obra qué recursos cambiaron.
 *
 * Qué cambió sale de la capacidad que la ruta exigió (`requireCapability` la
 * deja en `res.locals.exercisedCapability`) y del mapa `LIVE_WRITE_EFFECTS` de
 * `@luma/shared`: una ruta nueva que declare su capacidad entra sola, y el test
 * de `shared` obliga a decidir qué hace cada capacidad nueva.
 *
 * Se monta **antes** de `requireProjectAccess`, que es quien resuelve la obra:
 * se lee recién cuando la respuesta ya salió.
 */
export function publishLiveChanges(req: Request, res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  res.once('finish', () => {
    if (!succeeded(res) || !req.project) return;

    const capability = res.locals.exercisedCapability as Capability | undefined;
    if (!capability) return;

    liveHub.publish(String(req.project._id), liveResourcesForCapability(capability));
  });

  next();
}

/**
 * Tras un cambio de **quién puede qué** en la obra (miembros, roles, flags,
 * papelera), corta las conexiones abiertas: reconectan y se les vuelve a
 * resolver el acceso. Sin esto alguien que ya no es parte de la obra seguiría
 * recibiendo avisos hasta que venciera su conexión.
 */
export function closeLiveOnAccessChange(reason: LiveByeReason = 'access-changed') {
  return function closeLive(req: Request, res: Response, next: NextFunction) {
    res.once('finish', () => {
      if (!succeeded(res) || !req.project) return;
      liveHub.closeProject(String(req.project._id), reason);
    });

    next();
  };
}
