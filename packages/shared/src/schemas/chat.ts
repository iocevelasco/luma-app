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
