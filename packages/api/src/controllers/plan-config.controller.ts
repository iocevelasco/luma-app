import type { NextFunction, Request, Response } from 'express';
import { publishPlanConfigSchema } from '@luma/shared';
import { planCatalog, publishPlanConfig as publish } from '../services/plan-config.service.js';
import { badRequest, unauthenticated } from '../utils/errors.js';

/** `GET /api/admin/plan-config` — la lista vigente y las publicadas. */
export async function getPlanCatalog(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json({ success: true, data: { catalog: await planCatalog() } });
  } catch (error) {
    next(error);
  }
}

/** `POST /api/admin/plan-config` — publica una lista nueva. Lo ya pagado no cambia. */
export async function publishPlanConfig(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();
    const parsed = publishPlanConfigSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const version = await publish(parsed.data, req.user.sub);
    return res.status(201).json({ success: true, data: { version } });
  } catch (error) {
    next(error);
  }
}
