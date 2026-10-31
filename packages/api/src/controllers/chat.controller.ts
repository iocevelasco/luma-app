import type { NextFunction, Request, Response } from 'express';
import { chatSystemPromptSchema } from '@luma/shared';
import { NEXUSBOT_CONFIG } from '../config/app.config.js';
import { currentChatPrompt, saveChatPrompt } from '../services/chat-prompt.service.js';
import { badRequest, serviceUnavailable, unauthenticated } from '../utils/errors.js';

/**
 * `POST /api/chat/session` — abre una sesión de Nexusbot para quien está
 * logueado. El cuerpo y el status de Nexusbot se reenvían tal cual.
 */
export async function createChatSession(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();
    if (!NEXUSBOT_CONFIG.ENABLED || !NEXUSBOT_CONFIG.API_URL || !NEXUSBOT_CONFIG.API_KEY) {
      throw serviceUnavailable('El chat no está configurado.');
    }

    const response = await fetch(`${NEXUSBOT_CONFIG.API_URL}/api/v1/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': NEXUSBOT_CONFIG.API_KEY,
      },
      body: JSON.stringify({
        projectId: NEXUSBOT_CONFIG.PROJECT_ID,
        externalUserId: req.user.sub,
        userMetadata: { email: req.user.email },
      }),
    });

    const data: unknown = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    next(error);
  }
}

/** `GET /api/admin/chat-prompt` — el prompt guardado, o el texto por defecto. */
export async function getChatPrompt(_req: Request, res: Response, next: NextFunction) {
  try {
    const prompt = await currentChatPrompt();
    return res.json({ success: true, data: prompt });
  } catch (error) {
    next(error);
  }
}

/** `PUT /api/admin/chat-prompt` — lo guarda y lo manda a NexusBot. */
export async function updateChatPrompt(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();
    const parsed = chatSystemPromptSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);

    const prompt = await saveChatPrompt(parsed.data.systemPrompt, req.user.sub);
    return res.json({ success: true, data: prompt });
  } catch (error) {
    next(error);
  }
}
