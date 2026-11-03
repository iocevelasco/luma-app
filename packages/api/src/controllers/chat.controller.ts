import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { chatSystemPromptSchema, createChatSessionSchema } from '@luma/shared';
import { NEXUSBOT_CONFIG } from '../config/app.config.js';
import { currentChatPrompt, saveChatPrompt } from '../services/chat-prompt.service.js';
import { badRequest, serviceUnavailable, unauthenticated } from '../utils/errors.js';

/** Lo que pedimos a NexusBot al abrir una sesión; más que esto es un fallo suyo. */
const NEXUSBOT_TIMEOUT_MS = 10_000;

const nexusSessionSchema = z.object({
  sessionToken: z.string().min(1),
  expiresAt: z.string().min(1),
  expiresIn: z.number().positive(),
});

const CHAT_UNAVAILABLE = 'El chat no está disponible en este momento. Inténtalo de nuevo en unos minutos.';

/**
 * `POST /api/chat/session` — abre una sesión de NexusBot para quien está
 * logueado y devuelve sólo lo que el navegador necesita, en el sobre estándar.
 *
 * Nada de lo que diga NexusBot sale tal cual: su cuerpo puede traer detalles
 * internos (orígenes, proyectos, errores del modelo). Se loguea el status y
 * hacia afuera va un mensaje propio.
 *
 * La metadata va **vacía** a propósito: el asistente explica el producto y no
 * necesita el correo de la persona, que de otro modo viajaría al proveedor del
 * modelo y quedaría guardado en NexusBot.
 */
export async function createChatSession(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw unauthenticated();
    if (!NEXUSBOT_CONFIG.ENABLED || !NEXUSBOT_CONFIG.API_URL || !NEXUSBOT_CONFIG.API_KEY) {
      throw serviceUnavailable('El chat no está configurado.');
    }

    const parsed = createChatSessionSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw badRequest('Datos inválidos', parsed.error.issues);
    const { conversationId } = parsed.data;

    let response: globalThis.Response;
    try {
      response = await fetch(`${NEXUSBOT_CONFIG.API_URL}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': NEXUSBOT_CONFIG.API_KEY,
        },
        body: JSON.stringify({
          projectId: NEXUSBOT_CONFIG.PROJECT_ID,
          externalUserId: conversationId ? `${req.user.sub}:${conversationId}` : req.user.sub,
          userMetadata: {},
        }),
        signal: AbortSignal.timeout(NEXUSBOT_TIMEOUT_MS),
      });
    } catch {
      console.error('[chat] NexusBot no respondió al abrir la sesión');
      throw serviceUnavailable(CHAT_UNAVAILABLE);
    }

    if (!response.ok) {
      console.error(`[chat] NexusBot respondió ${response.status} al abrir la sesión`);
      throw serviceUnavailable(CHAT_UNAVAILABLE);
    }

    const body = nexusSessionSchema.safeParse(await response.json().catch(() => null));
    if (!body.success) {
      console.error('[chat] NexusBot devolvió una sesión con forma inesperada');
      throw serviceUnavailable(CHAT_UNAVAILABLE);
    }

    const { sessionToken, expiresAt, expiresIn } = body.data;
    res.json({ success: true, data: { sessionToken, expiresAt, expiresIn } });
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
