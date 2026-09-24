import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  getMyOrganization,
  inviteMember,
  listMembers,
  renameMyOrganization,
} from '../controllers/index.js';

export const organizationRouter = Router();

organizationRouter.get('/me', isAuthenticated, getMyOrganization);
organizationRouter.patch('/me', isAuthenticated, renameMyOrganization);
// Sin middleware de "dueño" propio: `findMyOrganizationId` sólo resuelve la
// Empresa donde el usuario es `role: 'owner'` — un Asistente no tiene una acá.
organizationRouter.get('/me/members', isAuthenticated, listMembers);
organizationRouter.post('/me/members', isAuthenticated, inviteMember);

export default organizationRouter;
