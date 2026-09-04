import { Router } from 'express';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import * as dashboardService from '../services/dashboard.service.js';

export const clientRouter = Router();

clientRouter.use(isAuthenticated, withProject);

/**
 * Vista del cliente (§2.4).
 *
 * Endpoint propio, no un dashboard filtrado. La diferencia importa: cuando
 * mañana se agregue un campo al dashboard interno —costos de mano de obra
 * individuales, notas del equipo— no hay forma de que se filtre acá por
 * omisión. Lo que el cliente ve está enumerado, no descontado.
 */
clientRouter.get(
  '/dashboard',
  requirePermission('dashboard.view.client'),
  asyncHandler(async (req, res) => {
    const data = await dashboardService.getClientDashboard(req.projectId!);
    res.json({ success: true, data });
  }),
);
