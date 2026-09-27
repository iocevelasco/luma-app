import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  requireProjectAccess,
  requireProjectEditor,
  requireProjectOwner,
} from '../middleware/project.middleware.js';
import {
  assignActivityToProvider,
  createProvider,
  deactivateProvider,
  listProviderActivities,
  listProviders,
  unassignActivityFromProvider,
  updateProvider,
} from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/providers` — ver routes/project.ts.
 * El directorio es de la Empresa (`project.organization`), pero se expone
 * siempre a través de un proyecto para reusar `requireProjectAccess` sin
 * inventar un middleware nuevo a nivel Organización.
 *
 * `requireProjectOwner` en las escrituras: es el "Ejecutante/Encargado" del
 * documento funcional — el Asistente de Obra ve el directorio y asigna
 * proveedores a actividades (ver activity.ts), pero no lo administra.
 */
export const providerRouter = Router({ mergeParams: true });

providerRouter.use(isAuthenticated, requireProjectAccess);

providerRouter.get('/', requireProjectEditor, listProviders);
providerRouter.post('/', requireProjectOwner, createProvider);
providerRouter.patch('/:providerId', requireProjectOwner, updateProvider);
providerRouter.delete('/:providerId', requireProjectOwner, deactivateProvider);

// Misma asignación N:N que activity.ts, vista desde el proveedor —
// `requireProjectEditor`: el Asistente de Obra también asigna desde acá.
providerRouter.get('/:providerId/activities', requireProjectEditor, listProviderActivities);
providerRouter.post('/:providerId/activities', requireProjectEditor, assignActivityToProvider);
providerRouter.delete(
  '/:providerId/activities/:activityId',
  requireProjectEditor,
  unassignActivityFromProvider,
);

export default providerRouter;
