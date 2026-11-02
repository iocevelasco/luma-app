/**
 * Asistente simulado del prototipo. No hay red, claves ni modelo: devuelve
 * texto Markdown por trozos para ejercitar el streaming. Algunas respuestas
 * son **hostiles a propósito** (HTML, `javascript:`, imágenes a hosts ajenos)
 * para ver los controles en vivo. Cuando haya backend, esto se reemplaza por
 * el stream real y todo lo que llegue sigue siendo no confiable.
 */
export class MockAssistantError extends Error {
  constructor() {
    super('mock-failure');
  }
}

export const HOSTILE_REPLY = [
  'Prueba de contenido hostil:',
  '',
  '<script>alert("xss")</script>',
  '<img src="x" onerror="alert(1)">',
  '',
  '[Enlace con javascript](javascript:alert(1)) y [enlace con data](data:text/html,<script>alert(1)</script>)',
  '',
  '![Imagen de un host no autorizado](https://tracker.example.net/pixel.png)',
  '',
  'Y el mismo HTML dentro de un bloque de código:',
  '',
  '```html',
  '<script>alert("xss")</script>',
  '<img src="x" onerror="alert(1)">',
  '```',
  '',
  'Un enlace válido: [Documentación de React](https://react.dev).',
].join('\n');

export const TABLE_REPLY = [
  'Resumen simulado de la obra:',
  '',
  '| Rubro | Presupuestado | Gastado |',
  '| --- | ---: | ---: |',
  '| Mampostería | 12.000 | 9.800 |',
  '| Electricidad | 6.500 | 2.100 |',
  '',
  '- **Avance:** 45 %',
  '- *Próximo hito:* losa del segundo piso',
  '',
  'Más información en [la guía](https://react.dev/learn).',
].join('\n');

const DEFAULT_REPLY =
  'Soy un **asistente simulado**. Probá escribir `xss` para ver contenido hostil bloqueado, `tabla` para ver una tabla, o `error` para ver un fallo recuperable.';

export function pickMockReply(prompt: string): string {
  const q = prompt.toLowerCase();
  if (q.includes('error')) throw new MockAssistantError();
  if (q.includes('xss') || q.includes('script') || q.includes('hostil')) return HOSTILE_REPLY;
  if (q.includes('tabla') || q.includes('resumen')) return TABLE_REPLY;
  return DEFAULT_REPLY;
}

export function chunkText(text: string, size = 12): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(id);
        reject(new DOMException('aborted', 'AbortError'));
      },
      { once: true },
    );
  });

export async function* streamMockReply(
  prompt: string,
  signal: AbortSignal,
  delayMs = 25,
): AsyncGenerator<string> {
  const reply = pickMockReply(prompt);
  for (const chunk of chunkText(reply)) {
    await sleep(delayMs, signal);
    yield chunk;
  }
}

/** Historial simulado, con una respuesta hostil para probar la restauración. */
export const MOCK_HISTORY = {
  title: 'Conversación anterior (simulada)',
  messages: [
    { role: 'user', content: 'Mostrame un resumen de la obra.' },
    { role: 'assistant', content: TABLE_REPLY },
    { role: 'user', content: 'Ahora probá con contenido hostil.' },
    { role: 'assistant', content: HOSTILE_REPLY },
  ],
};
