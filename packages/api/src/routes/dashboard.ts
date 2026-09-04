import { Router } from 'express';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';
import * as dashboardService from '../services/dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.use(isAuthenticated, withProject);

/** §3: el dashboard completo del equipo de gestión, en un solo request. */
dashboardRouter.get(
  '/',
  requirePermission('dashboard.view.full'),
  asyncHandler(async (req, res) => {
    const data = await dashboardService.getDashboard(req.projectId!, req.query.week as string);
    res.json({ success: true, data });
  }),
);

/** RF-10 aislado, para refrescar sólo las previsiones. */
dashboardRouter.get(
  '/forecast',
  requirePermission('dashboard.view.full'),
  asyncHandler(async (req, res) => {
    const data = await dashboardService.getDashboard(req.projectId!);
    res.json({ success: true, data: data.forecast });
  }),
);
