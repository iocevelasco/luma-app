import { afterEach, describe, expect, it, vi } from 'vitest';
import { failureFromCode, NexusHttpError, streamNexusChat } from './nexus-stream';
import { ChatTransportError } from './transport';

/** Una respuesta SSE hecha de los trozos que se le pasen, tal como llegarían por red. */
function sseResponse(chunks: string[], init: ResponseInit = { status: 200 }) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' }, ...init });
}

async function collect(gen: AsyncGenerator<string>) {
  const out: string[] = [];
  for await (const c of gen) out.push(c);
  return out;
}

const args = { apiUrl: 'https://nexus.example.com', sessionToken: 'tok', message: 'hola' };
let fetchMock: ReturnType<typeof vi.fn>;

function mockFetch(response: Response | Error) {
  fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  vi.stubGlobal('fetch', fetchMock);
}

afterEach(() => vi.unstubAllGlobals());

describe('streamNexusChat — petición', () => {
  it('manda el mensaje con el token en Authorization y sin credenciales del navegador', async () => {
    mockFetch(sseResponse(['data: [DONE]\n\n']));
    await collect(streamNexusChat(args));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://nexus.example.com/api/v1/chat/stream');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({ message: 'hola' });
    expect(init.credentials).toBe('omit');
    expect(init.referrerPolicy).toBe('no-referrer');
  });
});

describe('streamNexusChat — eventos', () => {
  it('entrega cada trozo de texto hasta [DONE]', async () => {
    mockFetch(sseResponse(['data: {"text":"Hola"}\n\n', 'data: {"text":" Ana"}\n\n', 'data: [DONE]\n\n']));
    expect(await collect(streamNexusChat(args))).toEqual(['Hola', ' Ana']);
  });

  it('arma eventos partidos entre lecturas, incluso a mitad de una palabra o de un salto', async () => {
    mockFetch(sseResponse(['data: {"te', 'xt":"Ho', 'la"}\n', '\ndata: {"text":"!"}\n\nda', 'ta: [DONE]\n\n']));
    expect(await collect(streamNexusChat(args))).toEqual(['Hola', '!']);
  });

  it('entiende \\r\\n e ignora los latidos y los comentarios', async () => {
    mockFetch(sseResponse([': ping\r\n\r\n', 'data: {"text":"a"}\r\n\r\n', ': otro\n\n', 'data: [DONE]\n\n']));
    expect(await collect(streamNexusChat(args))).toEqual(['a']);
  });

  it('el texto con HTML llega tal cual: escaparlo es trabajo del renderer', async () => {
    const hostile = '<script>alert(1)</script>';
    mockFetch(sseResponse([`data: ${JSON.stringify({ text: hostile })}\n\n`, 'data: [DONE]\n\n']));
    expect(await collect(streamNexusChat(args))).toEqual([hostile]);
  });

  it('un event: error corta el stream con un código, sin el mensaje del servidor', async () => {
    mockFetch(
      sseResponse([
        'data: {"text":"parcial"}\n\n',
        'event: error\ndata: {"error":{"code":"llm_error","message":"DeepSeek 500 en 10.0.0.5"}}\n\n',
      ]),
    );
    const out: string[] = [];
    let caught: unknown;
    try {
      for await (const c of streamNexusChat(args)) out.push(c);
    } catch (e) {
      caught = e;
    }
    expect(out).toEqual(['parcial']);
    expect(caught).toBeInstanceOf(ChatTransportError);
    expect((caught as ChatTransportError).failure).toBe('stream');
    expect((caught as Error).message).not.toMatch(/DeepSeek|10\.0/);
  });

  it('un JSON roto es un fallo del stream', async () => {
    mockFetch(sseResponse(['data: {no es json\n\n']));
    await expect(collect(streamNexusChat(args))).rejects.toMatchObject({ failure: 'stream' });
  });

  it('si la conexión se cierra sin [DONE], la respuesta quedó cortada', async () => {
    mockFetch(sseResponse(['data: {"text":"a medias"}\n\n']));
    await expect(collect(streamNexusChat(args))).rejects.toMatchObject({ failure: 'network' });
  });

  it('un evento que nunca termina no crece sin tope', async () => {
    mockFetch(sseResponse(['data: ' + 'x'.repeat(300 * 1024)]));
    await expect(collect(streamNexusChat(args))).rejects.toMatchObject({ failure: 'stream' });
  });
});

describe('streamNexusChat — errores HTTP y de red', () => {
  const cases: [number, string, string][] = [
    [401, 'token_expired', 'session'],
    [401, 'invalid_token', 'session'],
    [429, 'rate_limited', 'rate-limited'],
    [400, 'message_too_long', 'too-long'],
    [403, 'origin_not_allowed', 'unavailable'],
    [403, 'tenant_inactive', 'unavailable'],
  ];
  it.each(cases)('%s %s → %s', async (status, code, failure) => {
    mockFetch(new Response(JSON.stringify({ error: { code, message: 'Origen no permitido: https://interno' } }), { status }));
    const error = await collect(streamNexusChat(args)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NexusHttpError);
    expect(error).toMatchObject({ failure, code, status });
    expect((error as Error).message).not.toMatch(/interno|Origen/);
  });

  it('un cuerpo que no es JSON se resuelve por el status', async () => {
    mockFetch(new Response('<html>502</html>', { status: 502 }));
    await expect(collect(streamNexusChat(args))).rejects.toMatchObject({ failure: 'unavailable', status: 502 });
  });

  it('un fetch que falla es un problema de red', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    await expect(collect(streamNexusChat(args))).rejects.toMatchObject({ failure: 'network' });
  });

  it('cancelar con Detener propaga el AbortError y no es un fallo', async () => {
    mockFetch(new DOMException('aborted', 'AbortError'));
    await expect(collect(streamNexusChat(args))).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('failureFromCode', () => {
  it('cae al status cuando el código no se conoce', () => {
    expect(failureFromCode(undefined, 429)).toBe('rate-limited');
    expect(failureFromCode('raro', 503)).toBe('unavailable');
    expect(failureFromCode('raro', 401)).toBe('session');
    expect(failureFromCode(undefined)).toBe('stream');
  });
});
