import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  requireCapability,
  requireProjectAccess,
} from '../middleware/project.middleware.js';
import {
  assignActivityToProvider,
  createProvider,
  createProviderEngagement,
  deactivateProvider,
  deleteProviderEngagement,
  listProviderActivities,
  listProviderEngagements,
  listProviders,
  setRequirementMet,
  unassignActivityFromProvider,
  updateProvider,
  updateProviderEngagement,
  addProviderToProject,
  listProviderDirectory,
  removeProviderFromProject,
} from '../controllers/index.js';

/**
 * Anidado bajo `/api/projects/:projectId/providers` — ver routes/project.ts.
 * El directorio es de la Empresa (`project.organization`), pero se expone
 * siempre a través de un proyecto para reusar `requireProjectAccess` sin
 * inventar un middleware nuevo a nivel Organización.
 *
 * El directorio lo administra el gerente (`provider.manage`); el supervisor
 * lo ve y asigna proveedores a actividades (`provider.assign`) pero no da de
 * alta ni da de baja contactos. La plata comprometida (`engagement.write`) es
 * sólo del gerente.
 */
export const providerRouter = Router({ mergeParams: true });

providerRouter.use(isAuthenticated, requireProjectAccess);

// Lectura: gerente y supervisor siempre, el cliente sólo si la obra lo
// habilitó — esa excepción vive en la grilla, no acá.
providerRouter.get('/', requireCapability('provider.read'), listProviders);
providerRouter.post('/', requireCapability('provider.manage'), createProvider);

// Sumar a esta obra lo que ya está en la libreta de la Empresa. Antes que
// `/:providerId` para que "directory" no se lea como un id.
providerRouter.get('/directory', requireCapability('provider.manage'), listProviderDirectory);
providerRouter.post(
  '/directory/:providerId',
  requireCapability('provider.manage'),
  addProviderToProject,
);
providerRouter.delete(
  '/directory/:providerId',
  requireCapability('provider.manage'),
  removeProviderFromProject,
);
providerRouter.patch('/:providerId', requireCapability('provider.manage'), updateProvider);
providerRouter.delete('/:providerId', requireCapability('provider.manage'), deactivateProvider);

// Misma asignación N:N que activity.ts, vista desde el proveedor.
providerRouter.get(
  '/:providerId/activities',
  requireCapability('provider.read'),
  listProviderActivities,
);
providerRouter.post(
  '/:providerId/activities',
  requireCapability('provider.assign'),
  assignActivityToProvider,
);
providerRouter.delete(
  '/:providerId/activities/:activityId',
  requireCapability('provider.assign'),
  unassignActivityFromProvider,
);

/**
 * Contratación: la parte comercial es del gerente (`engagement.write`) porque
 * son montos comprometidos contra el presupuesto, y la matriz de roles no le
 * da economía al supervisor. La excepción es marcar requisitos cumplidos —
 * eso lo constata quien está en la obra, así que va con `provider.assign`.
 */
providerRouter.get(
  '/:providerId/engagements',
  requireCapability('provider.read'),
  listProviderEngagements,
);
providerRouter.post(
  '/:providerId/engagements',
  requireCapability('engagement.write'),
  createProviderEngagement,
);
providerRouter.patch(
  '/:providerId/engagements/:engagementId',
  requireCapability('engagement.write'),
  updateProviderEngagement,
);
providerRouter.delete(
  '/:providerId/engagements/:engagementId',
  requireCapability('engagement.write'),
  deleteProviderEngagement,
);
providerRouter.patch(
  '/:providerId/engagements/:engagementId/requirements/:requirementId',
  requireCapability('provider.assign'),
  setRequirementMet,
);

export default providerRouter;
