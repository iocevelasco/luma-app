import { z } from 'zod';

/**
 * Schema del chat del Consultor IA. `history` es lo que el frontend ya tiene
 * en pantalla — el server no lo persiste, sólo lo reenvía a Claude como
 * contexto de la conversación.
 */

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(4000),
});

export const sendChatMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'El mensaje no puede estar vacío')
    .max(2000, 'El mensaje es demasiado largo'),
  history: z.array(chatMessageSchema).max(20, 'El historial es demasiado largo').default([]),
});

export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

/** El prompt del asistente de Luma. Lo guarda la API y lo manda a NexusBot. */
export const chatSystemPromptSchema = z.object({
  systemPrompt: z
    .string()
    .trim()
    .min(1, 'El prompt no puede estar vacío')
    .max(20_000, 'El prompt es demasiado largo'),
});

export type ChatSystemPromptInput = z.infer<typeof chatSystemPromptSchema>;

/**
 * Abrir una sesión del chat. `conversationId` lo genera el navegador: cada
 * conversación nueva tiene el suyo, y NexusBot guarda la memoria por sesión,
 * así que "Nueva conversación" empieza de cero también en el servidor.
 */
export const createChatSessionSchema = z.object({
  conversationId: z
    .string()
    .regex(/^[A-Za-z0-9-]{8,64}$/, 'Identificador de conversación inválido')
    .optional(),
});

export type CreateChatSessionInput = z.infer<typeof createChatSessionSchema>;

/** Lo que recibe el navegador para hablar con NexusBot. El token es efímero. */
export interface ChatSession {
  sessionToken: string;
  /** ISO 8601. */
  expiresAt: string;
  /** Segundos de vida del token. */
  expiresIn: number;
}
