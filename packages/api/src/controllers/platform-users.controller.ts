import type { NextFunction, Request, Response } from 'express';
import { platformUsersQuerySchema, setUnlimitedPlanSchema } from '@luma/shared';
import { listPlatformUsers, platformUsersOverview } from '../services/platform-users.service.js';
import { setAccountUnlimited } from '../services/unlimited-plan.service.js';
import { badRequest } from '../utils/errors.js';

/** `GET /api/admin/users/overview` — totales de cuentas y altas por semana. */
export async function getPlatformUsersOverview(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json({ success: true, data: await platformUsersOverview() });
  } catch (error) {
    next(error);
  }
}

/** `GET /api/admin/users` — las cuentas, de la más nueva a la más vieja. */
export async function listPlatformUsersPage(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = platformUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    return res.json({ success: true, data: await listPlatformUsers(parsed.data) });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/admin/users/:userId/unlimited` — asigna o quita el plan ilimitado. */
export async function setPlatformUserUnlimited(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = String(req.params.userId);
    if (!/^[a-f0-9]{24}$/i.test(userId)) throw badRequest('Identificador inválido');
    const parsed = setUnlimitedPlanSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    return res.json({
      success: true,
      data: await setAccountUnlimited(userId, parsed.data.unlimited),
    });
  } catch (error) {
    next(error);
  }
}
