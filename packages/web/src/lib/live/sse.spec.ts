import { describe, expect, it } from 'vitest';
import { SseProtocolError, parseSseFrame, readSseFrames, type SseFrame } from './sse';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<SseFrame[]> {
  const frames: SseFrame[] = [];
  for await (const frame of readSseFrames(stream)) frames.push(frame);
  return frames;
}

describe('parseSseFrame', () => {
  it('lee evento y datos', () => {
    expect(parseSseFrame('event: invalidate\ndata: {"a":1}')).toEqual({
      event: 'invalidate',
      data: '{"a":1}',
    });
  });

  it('sin `event:` el nombre es `message`', () => {
    expect(parseSseFrame('data: hola')).toEqual({ event: 'message', data: 'hola' });
  });

  it('junta varias líneas de datos', () => {
    expect(parseSseFrame('data: uno\ndata: dos')?.data).toBe('uno\ndos');
  });

  it('un marco de sólo comentarios (latido `:`) no es un evento', () => {
    expect(parseSseFrame(': ping')).toBeNull();
    expect(parseSseFrame('')).toBeNull();
  });
});

describe('readSseFrames', () => {
  it('entrega cada marco completo', async () => {
    const frames = await collect(
      streamOf('event: ready\ndata: {"v":1}\n\nevent: ping\ndata: {"v":1}\n\n'),
    );
    expect(frames.map((f) => f.event)).toEqual(['ready', 'ping']);
  });

  it('arma un marco cortado entre dos lecturas', async () => {
    const frames = await collect(streamOf('event: inval', 'idate\ndata: {"v"', ':1}\n\n'));
    expect(frames).toEqual([{ event: 'invalidate', data: '{"v":1}' }]);
  });

  it('entiende \\r\\n y deja pasar los comentarios', async () => {
    const frames = await collect(streamOf(': hola\r\n\r\nevent: ping\r\ndata: {}\r\n\r\n'));
    expect(frames).toEqual([{ event: 'ping', data: '{}' }]);
  });

  it('un marco sin terminar no queda entregado', async () => {
    expect(await collect(streamOf('event: ping\ndata: {}'))).toEqual([]);
  });

  it('corta si el marco pendiente crece sin límite', async () => {
    await expect(collect(streamOf('data: ' + 'x'.repeat(70 * 1024)))).rejects.toBeInstanceOf(
      SseProtocolError,
    );
  });
});
