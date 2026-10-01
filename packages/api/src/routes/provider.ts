import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  requireProjectAccess,
  requireProjectEditor,
  requireProjectOwner,
  requireProviderRead,
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

// Lectura: dueño, Asistente, y el cliente sólo si la obra lo habilitó.
providerRouter.get('/', requireProviderRead, listProviders);
providerRouter.post('/', requireProjectOwner, createProvider);
providerRouter.patch('/:providerId', requireProjectOwner, updateProvider);
providerRouter.delete('/:providerId', requireProjectOwner, deactivateProvider);

// Misma asignación N:N que activity.ts, vista desde el proveedor —
// `requireProjectEditor`: el Asistente de Obra también asigna desde acá.
providerRouter.get('/:providerId/activities', requireProviderRead, listProviderActivities);
providerRouter.post('/:providerId/activities', requireProjectEditor, assignActivityToProvider);
providerRouter.delete(
  '/:providerId/activities/:activityId',
  requireProjectEditor,
  unassignActivityFromProvider,
);

/**
 * Contratación (RF nuevo): la parte comercial la gestiona el dueño
 * (`requireProjectOwner`) porque son montos comprometidos contra el
 * presupuesto. La excepción es marcar requisitos cumplidos: eso lo hace quien
 * está en la obra, así que va con `requireProjectEditor`.
 */
providerRouter.get('/:providerId/engagements', requireProviderRead, listProviderEngagements);
providerRouter.post('/:providerId/engagements', requireProjectOwner, createProviderEngagement);
providerRouter.patch(
  '/:providerId/engagements/:engagementId',
  requireProjectOwner,
  updateProviderEngagement,
);
providerRouter.delete(
  '/:providerId/engagements/:engagementId',
  requireProjectOwner,
  deleteProviderEngagement,
);
providerRouter.patch(
  '/:providerId/engagements/:engagementId/requirements/:requirementId',
  requireProjectEditor,
  setRequirementMet,
);

export default providerRouter;
