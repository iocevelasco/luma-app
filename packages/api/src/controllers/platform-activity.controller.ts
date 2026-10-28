import type { NextFunction, Request, Response } from 'express';
import { platformActivityReport } from '../services/platform-activity.service.js';

/**
 * `GET /api/admin/activity` — cuánto hace la gente por rol de obra. Sólo
 * conteos; las celdas con pocas personas ya salen suprimidas del servicio.
 */
export async function getPlatformActivity(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.json({ success: true, data: await platformActivityReport() });
  } catch (error) {
    next(error);
  }
}
