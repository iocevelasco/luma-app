import { Router } from 'express';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import {
  createCalendarFeed,
  deleteCalendarFeed,
  getCalendarFeedStatus,
} from '../controllers/index.js';

/** El feed de calendario personal, con sesión (ADR-005 §3). El feed en sí es público: `routes/public.ts`. */
export const calendarRouter = Router();

calendarRouter.use(isAuthenticated);
calendarRouter.get('/feed', getCalendarFeedStatus);
calendarRouter.post('/feed', createCalendarFeed);
calendarRouter.delete('/feed', deleteCalendarFeed);

export default calendarRouter;
