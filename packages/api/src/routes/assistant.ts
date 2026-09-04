import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { assistantAskSchema } from '@luma/shared';
import { isAuthenticated, requirePermission, withProject } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import * as assistantService from '../services/assistant.service.js';
import { ASSISTANT_ENABLED, isProduction } from '../config/app.config.js';
import { notFound } from '../utils/errors.js';

export const assistantRouter = Router();

assistantRouter.use(isAuthenticated, withProject);

/**
 * Límite por usuario, además del tope diario por proyecto que aplica el
 * servicio. Cada consulta cuesta plata (§12): el rate limit acota el pico y el
 * tope diario acota el total.
 */
const askLimiter = isProduction
  ? rateLimit({
      windowMs: 60 * 1000,
      max: 12,
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Esperá un momento antes de la próxima consulta.' },
    })
  : (_req: unknown, _res: unknown, next: () => void) => next();

assistantRouter.get('/status', (_req, res) => {
  res.json({ success: true, data: { enabled: ASSISTANT_ENABLED } });
});

assistantRouter.post(
  '/ask',
  requirePermission('assistant.use'),
  askLimiter,
  validateBody(assistantAskSchema),
  asyncHandler(async (req, res) => {
    const result = await assistantService.ask({
      projectId: req.projectId!,
      userId: req.user!.sub,
      role: req.projectRole!,
      message: req.body.message,
      conversationId: req.body.conversation_id,
    });
    res.json({ success: true, data: result });
  }),
);

assistantRouter.get(
  '/conversations',
  requirePermission('assistant.use'),
  asyncHandler(async (req, res) => {
    const list = await assistantService.listConversations(req.projectId!, req.user!.sub);
    res.json({ success: true, data: list.map((c) => ({ ...c, id: c._id.toString() })) });
  }),
);

assistantRouter.get(
  '/conversations/:id',
  requirePermission('assistant.use'),
  asyncHandler(async (req, res) => {
    const conversation = await assistantService.getConversation(
      req.projectId!,
      req.user!.sub,
      req.params.id,
    );
    if (!conversation) throw notFound('Conversación no encontrada');
    res.json({ success: true, data: { ...conversation, id: conversation._id.toString() } });
  }),
);
