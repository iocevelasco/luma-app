import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { getMyOrganization, renameMyOrganization } from '../controllers/index.js';

export const organizationRouter = Router();

organizationRouter.get('/me', isAuthenticated, getMyOrganization);
organizationRouter.patch('/me', isAuthenticated, renameMyOrganization);

export default organizationRouter;
