import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireWritableSubscription } from '../middleware/subscription.middleware.js';
import {
  createOrganizationCrewMember,
  createOrganizationProvider,
  deactivateOrganizationCrewMember,
  deactivateOrganizationProvider,
  getMyOrganization,
  inviteMember,
  listMembers,
  listOrganizationCrew,
  listOrganizationProviders,
  removeMember,
  renameMyOrganization,
  resendMemberInvitation,
  setOrganizationCrewMemberProjects,
  setOrganizationProviderProjects,
  updateMember,
  updateOrganizationCrewMember,
  updateOrganizationProvider,
} from '../controllers/index.js';

export const organizationRouter = Router();

// Suscripción vencida = sólo lectura también acá. Va antes de todas las rutas:
// deja pasar los GET y frena el resto. Necesita `req.user`, así que lleva su
// propio `isAuthenticated` (es idempotente con el de cada ruta).
organizationRouter.use(isAuthenticated, requireWritableSubscription);

organizationRouter.get('/me', isAuthenticated, getMyOrganization);
organizationRouter.patch('/me', isAuthenticated, renameMyOrganization);
// Sin middleware de "dueño" propio: `findMyOrganizationId` sólo resuelve la
// Empresa donde el usuario es `role: 'owner'` — un Asistente no tiene una acá.
organizationRouter.get('/me/members', isAuthenticated, listMembers);
organizationRouter.post('/me/members', isAuthenticated, inviteMember);
organizationRouter.patch('/me/members/:memberId', isAuthenticated, updateMember);
organizationRouter.delete('/me/members/:memberId', isAuthenticated, removeMember);
organizationRouter.post('/me/members/:memberId/resend', isAuthenticated, resendMemberInvitation);

// Libreta de la Empresa: alta, edición, baja y en qué obras está cada uno. Es
// del dueño por el mismo motivo que arriba. Sumar a una obra lo ya cargado
// también se puede hacer desde la obra (ver routes/provider.ts y routes/crew.ts).
organizationRouter.get('/me/providers', isAuthenticated, listOrganizationProviders);
organizationRouter.post('/me/providers', isAuthenticated, createOrganizationProvider);
organizationRouter.patch('/me/providers/:providerId', isAuthenticated, updateOrganizationProvider);
organizationRouter.delete(
  '/me/providers/:providerId',
  isAuthenticated,
  deactivateOrganizationProvider,
);
organizationRouter.put(
  '/me/providers/:providerId/projects',
  isAuthenticated,
  setOrganizationProviderProjects,
);

organizationRouter.get('/me/crew', isAuthenticated, listOrganizationCrew);
organizationRouter.post('/me/crew', isAuthenticated, createOrganizationCrewMember);
organizationRouter.patch('/me/crew/:crewMemberId', isAuthenticated, updateOrganizationCrewMember);
organizationRouter.delete(
  '/me/crew/:crewMemberId',
  isAuthenticated,
  deactivateOrganizationCrewMember,
);
organizationRouter.put(
  '/me/crew/:crewMemberId/projects',
  isAuthenticated,
  setOrganizationCrewMemberProjects,
);

export default organizationRouter;
