import { describe, expect, it } from 'vitest';
import { sendChatMessageSchema } from './chat.js';

describe('sendChatMessageSchema', () => {
  it('acepta un mensaje sin historial', () => {
    const result = sendChatMessageSchema.safeParse({ message: '¿Cómo viene el cronograma?' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.history).toEqual([]);
  });

  it('acepta un mensaje con historial', () => {
    const result = sendChatMessageSchema.safeParse({
      message: '¿Y el presupuesto?',
      history: [
        { role: 'user', content: '¿Cómo viene el cronograma?' },
        { role: 'assistant', content: 'Hay dos actividades atrasadas.' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un mensaje vacío', () => {
    expect(sendChatMessageSchema.safeParse({ message: '' }).success).toBe(false);
  });

  it('rechaza un mensaje demasiado largo', () => {
    expect(sendChatMessageSchema.safeParse({ message: 'a'.repeat(2001) }).success).toBe(false);
  });

  it('rechaza un role de historial inválido', () => {
    const result = sendChatMessageSchema.safeParse({
      message: 'hola',
      history: [{ role: 'system', content: 'algo' }],
    });
    expect(result.success).toBe(false);
  });

  it('rechaza más de 20 mensajes de historial', () => {
    const history = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `mensaje ${i}`,
    }));
    expect(sendChatMessageSchema.safeParse({ message: 'hola', history }).success).toBe(false);
  });
});
