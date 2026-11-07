import { chatSystemPromptSchema } from '@luma/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CHAT_SYSTEM_PROMPT } from '../../services/chat-prompt.service.js';

/**
 * El prompt por defecto es lo que la administración guarda y publica. No se
 * prueba cómo contesta el modelo (eso es `chat-scope`), sino que el texto cabe,
 * dice lo que el producto hace y no se contradice con él.
 */
describe('el prompt del asistente', () => {
  it('cabe en lo que la administración puede guardar', () => {
    expect(chatSystemPromptSchema.safeParse({ systemPrompt: DEFAULT_CHAT_SYSTEM_PROMPT }).success).toBe(true);
  });

  describe('Inventario y Depósito General', () => {
    it('el menú de la obra y el principal incluyen las pantallas nuevas', () => {
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('Detalle, Actividades, Compras, Inventario, Personal,');
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('el menú principal tiene cuatro destinos');
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toMatch(/^- Depósito\. /m);
    });

    it('explica el inventario: las dos pestañas, las salidas y que el kardex no se edita', () => {
      for (const text of ['Kardex', 'En patio', 'Por agotarse', 'Entrega', 'Merma', 'pide el motivo y el responsable', 'no se edita ni se borra']) {
        expect(DEFAULT_CHAT_SYSTEM_PROMPT, text).toContain(text);
      }
    });

    it('explica el Depósito: enviar, importar a costo 0, flete y ahorro', () => {
      for (const text of ['Enviar al Depósito', 'Importar del Depósito', 'a costo 0', 'flete', 'Ahorro por reutilización']) {
        expect(DEFAULT_CHAT_SYSTEM_PROMPT, text).toContain(text);
      }
    });

    it('Compras avisa que «Llegó a obra» alimenta el inventario', () => {
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('el material entra solo al Inventario de la obra');
    });

    it('dice quién ve y quién opera cada cosa, como la grilla de permisos', () => {
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('registran el gerente y el supervisor');
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('Solo lo hace quien creó la obra');
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('El contador y el cliente no lo ven');
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('En el Inventario solo miran');
    });

    it('no le atribuye al Consultor lo que no lee ni deja al chat inventar el stock', () => {
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('El Consultor no consulta el Inventario ni el Depósito General');
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('cantidades de material en el patio');
    });

    it('la papelera y el Depósito: borrar una obra no se lleva el material de la Empresa', () => {
      expect(DEFAULT_CHAT_SYSTEM_PROMPT).toContain('también el material del Depósito General');
    });
  });
});
