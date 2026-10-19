import type { NextFunction, Request, Response } from 'express';
import { findMyOrganizationId } from '../services/organization.service.js';
import { stateFor } from '../services/subscription.service.js';

/**
 * Sólo lectura también fuera de las obras: el directorio de proveedores, los
 * empleados y el equipo de la Empresa (`/api/organizations/me/*`).
 *
 * Deja pasar cualquier lectura. Para escribir, la suscripción de MI Empresa
 * tiene que estar al día. Dentro de una obra lo resuelve
 * `requireProjectAccess`, que mira la Empresa dueña de la obra y no la mía.
 *
 * Ir siempre después de `isAuthenticated`.
 */
export async function requireWritableSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const organizationId = await findMyOrganizationId(req.user.sub);
    // Sin Empresa no hay nada que bloquear: el controller decide qué contestar.
    if (!organizationId) return next();

    const state = await stateFor(organizationId);
    if (state.canWrite) return next();

    return res.status(402).json({
      success: false,
      error: 'Tu suscripción venció: tu Empresa está en sólo lectura. Renová el plan para editar.',
      code: 'SUBSCRIPTION_REQUIRED',
    });
  } catch (error) {
    next(error);
  }
}
