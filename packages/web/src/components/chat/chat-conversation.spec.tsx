import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from '@/lib/chat/chat-store';
import { CHAT_LIMITS } from '@/lib/chat/limits';
import { HOSTILE_REPLY, MOCK_HISTORY } from '@/lib/chat/mock-assistant';
import { jpegBytes, makeFile, pngBytes, stubObjectUrls } from '@/test/chat-fixtures';
import { ChatConversation } from './chat-conversation';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, o?: { name?: string; count?: number }) =>
      o?.name ? `${key}:${o.name}` : o?.count !== undefined ? `${key}:${o.count}` : key,
  }),
}));

// El stream lo controla cada test: se empuja un trozo y se mira el DOM.
const control = vi.hoisted(() => {
  const queue: (string | Error | null)[] = [];
  let wake: (() => void) | null = null;
  return {
    push(item: string | Error | null) {
      queue.push(item);
      wake?.();
    },
    reset() {
      queue.length = 0;
      wake = null;
    },
    async *stream() {
      for (;;) {
        while (!queue.length) await new Promise<void>((r) => (wake = r));
        const item = queue.shift()!;
        if (item === null) return;
        if (item instanceof Error) throw item;
        yield item;
      }
    },
  };
});
vi.mock('@/lib/chat/mock-assistant', async (original) => ({
  ...(await original<typeof import('@/lib/chat/mock-assistant')>()),
  streamMockReply: () => control.stream(),
}));

/** Storage en memoria: el entorno de test no siempre trae uno, y así se ve cada escritura. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => Array.from(data.keys())[i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

let urls: ReturnType<typeof stubObjectUrls>;
const consoleSpies = ['log', 'info', 'warn', 'error', 'debug'].map((m) =>
  vi.spyOn(console, m as 'log').mockImplementation(() => {}),
);

beforeEach(() => {
  urls = stubObjectUrls();
  control.reset();
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(window, name, { value: memoryStorage(), configurable: true });
  }
  act(() => useChatStore.getState().reset());
  consoleSpies.forEach((s) => s.mockClear());
});
afterEach(() => {
  act(() => useChatStore.getState().stop());
});

async function sendMessage(text: string) {
  await userEvent.type(screen.getByLabelText('secureChat.inputLabel'), text);
  await userEvent.click(screen.getByRole('button', { name: /secureChat.send/ }));
}

function assistantBubble() {
  return screen.getByTestId('message-assistant');
}

/** Revisa el registro de mensajes (el composer tiene su propio <form>). */
function messages(): HTMLElement {
  return screen.getByRole('log');
}

function expectSafe(root: HTMLElement) {
  expect(root.querySelector('script, iframe, form, object, embed')).toBeNull();
  expect(root.querySelector('a[href^="javascript"], a[href^="data"]')).toBeNull();
  for (const el of Array.from(root.querySelectorAll('*'))) {
    expect(Array.from(el.attributes).filter((a) => a.name.startsWith('on'))).toEqual([]);
  }
}

describe('durante el streaming', () => {
  it('aplica los controles en cada trozo y los mantiene al terminar', async () => {
    render(<ChatConversation />);
    await sendMessage('hola');

    const chunks = HOSTILE_REPLY.match(/[\s\S]{1,9}/g)!;
    let text = '';
    for (const chunk of chunks) {
      text += chunk;
      await act(async () => control.push(chunk));
      await waitFor(() => expect(useChatStore.getState().messages[1].content).toBe(text));
      expectSafe(messages());
    }
    expect(assistantBubble()).toHaveAttribute('aria-busy', 'true');

    await act(async () => control.push(null));
    await waitFor(() => expect(assistantBubble()).toHaveAttribute('aria-busy', 'false'));

    // Final: el HTML se ve como texto o código, los enlaces peligrosos están bloqueados.
    expectSafe(messages());
    expect(within(assistantBubble()).getAllByTestId('blocked-link').length).toBeGreaterThan(0);
    expect(within(assistantBubble()).getByText(/tracker\.example\.net|secureChat.blockedImage/)).toBeInTheDocument();
    expect(assistantBubble().querySelector('pre code')?.textContent).toContain('<script>alert("xss")</script>');
    expect(within(assistantBubble()).getByRole('link', { name: /Documentación de React/ })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('un stream que revienta deja un error comprensible, sin detalles internos ni logs', async () => {
    render(<ChatConversation />);
    await sendMessage('mensaje privado 123');
    await act(async () => control.push(new Error('MongoServerError: connection <host:27017> stack at /srv/app.js:10')));

    await waitFor(() => expect(screen.getByTestId('chat-notices')).toHaveTextContent('secureChat.errors.stream'));
    expect(document.body.textContent).not.toMatch(/Mongo|stack|27017|app\.js/);
    expect(document.body.textContent).toContain('secureChat.errors.stream');
    // Recuperable: se puede enviar otra vez.
    expect(useChatStore.getState().isStreaming).toBe(false);
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });

  it('un stream que no termina no hace crecer el mensaje más allá del tope', async () => {
    render(<ChatConversation />);
    await sendMessage('hola');
    await act(async () => control.push('a'.repeat(CHAT_LIMITS.maxAssistantChars + 500)));
    await waitFor(() => expect(useChatStore.getState().isStreaming).toBe(false));
    expect(useChatStore.getState().messages[1].content.length).toBe(CHAT_LIMITS.maxAssistantChars);
  });
});

describe('al restaurar el historial', () => {
  it('un historial hostil se renderiza con los mismos controles', () => {
    act(() => useChatStore.getState().restore(MOCK_HISTORY));
    render(<ChatConversation />);

    expect(screen.getAllByTestId('message-assistant')).toHaveLength(2);
    expectSafe(messages());
    expect(screen.getAllByTestId('blocked-link').length).toBeGreaterThan(0);
    expect(document.querySelector('pre code')?.textContent).toContain('onerror="alert(1)"');
    expect(document.querySelector('table')).not.toBeNull();
  });

  it('valida la forma, los límites y los adjuntos forjados del historial', () => {
    act(() =>
      useChatStore.getState().restore({
        title: 'T'.repeat(500),
        messages: [
          { role: 'system', content: 'x' },
          { role: 'assistant', content: 42 },
          'texto suelto',
          null,
          { role: 'user', content: 'u'.repeat(CHAT_LIMITS.maxUserChars + 10) },
          {
            role: 'assistant',
            content: 'ok',
            attachments: [{ name: '<img src=x onerror=alert(1)>.png', previewUrl: 'blob:https://luma.test/forjada' }],
          },
        ],
      }),
    );
    const state = useChatStore.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0].content).toHaveLength(CHAT_LIMITS.maxUserChars);
    expect(state.discarded).toBe(4);

    render(<ChatConversation />);
    expect(screen.getByTestId('restore-notice')).toBeInTheDocument();
    // El adjunto con blob forjado no se carga y su nombre es sólo texto.
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getAllByTestId('blocked-image').length).toBe(1);
    expect(document.querySelector('figcaption')?.textContent).toBe('<img src=x onerror=alert(1)>.png');
    expect(document.querySelector('figcaption img')).toBeNull();
  });

  it('un historial que no es un objeto produce una conversación vacía', () => {
    for (const bad of [null, undefined, 'x', 7, [], { messages: 'no' }]) {
      act(() => useChatStore.getState().restore(bad));
      expect(useChatStore.getState().messages).toEqual([]);
    }
  });
});

describe('adjuntos en la conversación', () => {
  const upload = (...files: File[]) => userEvent.upload(screen.getByTestId('file-input'), files, { applyAccept: false });

  it('rechaza los no permitidos y los demasiado grandes, y muestra el nombre como texto', async () => {
    render(<ChatConversation />);
    const big = new Uint8Array(CHAT_LIMITS.maxFileBytes + 1);
    big.set(pngBytes());
    await upload(
      makeFile('<svg onload="alert(1)"/>', 'logo.svg', 'image/svg+xml'),
      makeFile('<script>alert(1)</script>', 'foto.png', 'image/png'),
      makeFile(big, 'enorme.png', 'image/png'),
    );

    const notices = await screen.findByTestId('chat-notices');
    expect(notices).toHaveTextContent('secureChat.rejections.type:logo.svg');
    expect(notices).toHaveTextContent('secureChat.rejections.type:foto.png');
    expect(notices).toHaveTextContent('secureChat.rejections.tooLarge:enorme.png');
    expect(useChatStore.getState().draftAttachments).toEqual([]);
    expect(urls.created).toHaveLength(0);
  });

  it('un nombre con HTML se muestra como texto', async () => {
    render(<ChatConversation />);
    await upload(makeFile(pngBytes(), '<img src=x onerror=alert(1)>.png', 'image/png'));

    await waitFor(() => expect(document.querySelector('figcaption')).not.toBeNull());
    expect(document.querySelector('figcaption')?.textContent).toBe('<img src=x onerror=alert(1)>.png');
    expect(document.querySelector('figcaption img, [onerror]')).toBeNull();
  });

  it('acepta una imagen válida, la envía y revoca las vistas previas al empezar de nuevo', async () => {
    render(<ChatConversation />);
    await upload(makeFile(jpegBytes(), 'obra.jpg', 'image/jpeg'));
    await waitFor(() => expect(useChatStore.getState().draftAttachments).toHaveLength(1));
    const preview = useChatStore.getState().draftAttachments[0].previewUrl;
    expect(preview.startsWith('blob:')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /secureChat.send/ }));
    await waitFor(() => expect(screen.getByTestId('message-user')).toBeInTheDocument());
    expect(within(screen.getByTestId('message-user')).getByRole('img', { name: 'obra.jpg' })).toHaveAttribute('src', preview);

    await act(async () => control.push(null));
    await userEvent.click(screen.getByRole('button', { name: /secureChat.newConversation/ }));
    expect(urls.revoked).toContain(preview);
  });

  it('quitar un adjunto antes de enviar revoca su vista previa', async () => {
    render(<ChatConversation />);
    await upload(makeFile(pngBytes(), 'a.png', 'image/png'));
    await waitFor(() => expect(useChatStore.getState().draftAttachments).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'secureChat.removeAttachment:a.png' }));
    expect(urls.revoked).toHaveLength(1);
    expect(useChatStore.getState().draftAttachments).toEqual([]);
  });
});

describe('límites del mensaje, privacidad y estado', () => {
  it('no envía mensajes vacíos', async () => {
    render(<ChatConversation />);
    await userEvent.click(screen.getByRole('button', { name: /secureChat.send/ }));
    expect(screen.getByTestId('chat-notices')).toHaveTextContent('secureChat.errors.empty');
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it('rechaza un mensaje que pasa el máximo (el store lo vuelve a comprobar)', async () => {
    render(<ChatConversation />);
    await act(() => useChatStore.getState().send('x'.repeat(CHAT_LIMITS.maxUserChars + 1)));
    expect(useChatStore.getState().error).toBe('too-long');
    expect(useChatStore.getState().messages).toEqual([]);
  });

  it('el texto de la persona se muestra como texto, no como Markdown ni HTML', async () => {
    render(<ChatConversation />);
    await sendMessage('<b>hola</b> **negrita**');
    const mine = await screen.findByTestId('message-user');
    expect(mine.querySelector('b, strong')).toBeNull();
    expect(mine.textContent).toContain('<b>hola</b> **negrita**');
  });

  it('cerrar el panel (desmontar) conserva la conversación en memoria', async () => {
    const { unmount } = render(<ChatConversation />);
    await sendMessage('hola');
    await act(async () => control.push('Respuesta'));
    await act(async () => control.push(null));
    await waitFor(() => expect(useChatStore.getState().isStreaming).toBe(false));
    unmount();

    render(<ChatConversation />);
    expect(screen.getByTestId('message-user')).toHaveTextContent('hola');
    expect(screen.getByTestId('message-assistant')).toHaveTextContent('Respuesta');
  });

  it('no persiste la conversación ni los adjuntos en localStorage/sessionStorage', async () => {
    render(<ChatConversation />);
    await sendMessage('dato sensible 999');
    await act(async () => control.push('respuesta'));
    await act(async () => control.push(null));
    await waitFor(() => expect(useChatStore.getState().isStreaming).toBe(false));
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });
});

describe('copiar, pegar, arrastrar y enviar con Enter', () => {
  const textbox = () => screen.getByLabelText('secureChat.inputLabel');

  it('Enter envía y Shift+Enter hace un salto de línea sin enviar', async () => {
    render(<ChatConversation />);
    await userEvent.type(textbox(), 'hola{Shift>}{Enter}{/Shift}mundo');
    expect(useChatStore.getState().messages).toEqual([]);
    expect((textbox() as HTMLTextAreaElement).value).toBe('hola\nmundo');

    await userEvent.type(textbox(), '{Enter}');
    await waitFor(() => expect(useChatStore.getState().messages[0]?.content).toBe('hola\nmundo'));
    expect((textbox() as HTMLTextAreaElement).value).toBe('');
  });

  it('Enter con el campo vacío no envía y avisa', async () => {
    render(<ChatConversation />);
    await userEvent.type(textbox(), '{Enter}');
    expect(screen.getByTestId('chat-notices')).toHaveTextContent('secureChat.errors.empty');
  });

  it('copia el texto original de la respuesta, no el HTML renderizado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    act(() => useChatStore.getState().restore(MOCK_HISTORY));
    render(<ChatConversation />);

    const buttons = screen.getAllByRole('button', { name: 'secureChat.copy' });
    expect(buttons).toHaveLength(2); // sólo respuestas del asistente
    await userEvent.click(buttons[1]);
    expect(writeText).toHaveBeenCalledWith(HOSTILE_REPLY);
    expect(await screen.findByText('secureChat.copied')).toBeInTheDocument();
  });

  it('si el portapapeles no está disponible, lo avisa', async () => {
    Object.defineProperty(window.navigator, 'clipboard', { value: undefined, configurable: true });
    act(() => useChatStore.getState().restore(MOCK_HISTORY));
    render(<ChatConversation />);
    await userEvent.click(screen.getAllByRole('button', { name: 'secureChat.copy' })[0]);
    expect(await screen.findByText('secureChat.copyFailed')).toBeInTheDocument();
  });

  it('pegar una imagen la adjunta; pegar un SVG la rechaza; pegar texto no adjunta nada', async () => {
    render(<ChatConversation />);
    fireEvent.paste(textbox(), { clipboardData: { files: [makeFile(pngBytes(), 'image.png', 'image/png')], types: ['Files'] } });
    await waitFor(() => expect(useChatStore.getState().draftAttachments).toHaveLength(1));

    fireEvent.paste(textbox(), { clipboardData: { files: [makeFile('<svg onload="alert(1)"/>', 'x.svg', 'image/svg+xml')], types: ['Files'] } });
    expect(await screen.findByTestId('chat-notices')).toHaveTextContent('secureChat.rejections.type:x.svg');

    fireEvent.paste(textbox(), { clipboardData: { files: [], types: ['text/plain'], getData: () => 'texto' } });
    expect(useChatStore.getState().draftAttachments).toHaveLength(1);
  });

  it('arrastrar imágenes muestra la zona y las adjunta con la misma validación', async () => {
    const { container } = render(<ChatConversation />);
    const zone = container.firstElementChild as HTMLElement;
    const files = [makeFile(jpegBytes(), 'a.jpg', 'image/jpeg'), makeFile('<script>alert(1)</script>', 'b.png', 'image/png')];

    fireEvent.dragOver(zone, { dataTransfer: { types: ['Files'], files } });
    expect(screen.getByTestId('drop-overlay')).toBeInTheDocument();

    fireEvent.drop(zone, { dataTransfer: { types: ['Files'], files } });
    expect(screen.queryByTestId('drop-overlay')).toBeNull();
    await waitFor(() => expect(useChatStore.getState().draftAttachments).toHaveLength(1));
    expect(await screen.findByTestId('chat-notices')).toHaveTextContent('secureChat.rejections.type:b.png');
  });

  it('arrastrar texto o una URL no hace nada', () => {
    const { container } = render(<ChatConversation />);
    const zone = container.firstElementChild as HTMLElement;
    fireEvent.dragOver(zone, { dataTransfer: { types: ['text/uri-list', 'text/plain'], files: [] } });
    fireEvent.drop(zone, { dataTransfer: { types: ['text/uri-list'], files: [] } });
    expect(screen.queryByTestId('drop-overlay')).toBeNull();
    expect(useChatStore.getState().draftAttachments).toEqual([]);
  });
});
