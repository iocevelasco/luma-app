import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { ChatTransportError } from '@/lib/chat/transport';
import { LiveChat } from './live-chat';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { name: 'Ana Pérez' } }) }));

const api = vi.hoisted(() => ({ createSession: vi.fn() }));
vi.mock('@/api/chat', () => ({ chatApi: { createSession: api.createSession } }));

const net = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock('@/lib/chat/nexus-stream', async (original) => ({
  ...(await original<typeof import('@/lib/chat/nexus-stream')>()),
  streamNexusChat: (a: unknown) => net.stream(a),
}));

function renderLive() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LiveChat />
    </QueryClientProvider>,
  );
}

async function openAndSend(text: string) {
  await userEvent.click(screen.getByRole('button', { name: 'secureChat.openLive' }));
  await userEvent.type(await screen.findByLabelText('secureChat.inputLabel'), text);
  await userEvent.click(screen.getByRole('button', { name: 'secureChat.send' }));
}

beforeEach(() => {
  api.createSession.mockReset().mockResolvedValue({
    sessionToken: 'tok',
    expiresAt: '2999-01-01T00:00:00.000Z',
    expiresIn: 900,
  });
  net.stream.mockReset().mockImplementation(async function* () {
    yield 'Hola **Ana**';
  });
});

describe('LiveChat', () => {
  it('abre el panel y responde con lo que llega de NexusBot, renderizado con los mismos controles', async () => {
    net.stream.mockImplementation(async function* () {
      yield 'Mira <script>alert(1)</script> y **esto**';
    });
    renderLive();
    await openAndSend('hola');

    const reply = await screen.findByTestId('message-assistant');
    await waitFor(() => expect(reply.querySelector('strong')?.textContent).toBe('esto'));
    expect(reply.querySelector('script')).toBeNull();
    expect(api.createSession).toHaveBeenCalledWith(expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/));
    expect(net.stream).toHaveBeenCalledWith(expect.objectContaining({ sessionToken: 'tok', message: 'hola' }));
  });

  it('saluda a la persona y un iniciador abre la sesión y envía su frase', async () => {
    renderLive();
    await userEvent.click(screen.getByRole('button', { name: 'secureChat.openLive' }));
    expect(await screen.findByTestId('chat-welcome')).toHaveTextContent('secureChat.greeting');
    expect(screen.getAllByRole('button', { name: /^secureChat\.starters\./ })).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'secureChat.send' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'secureChat.starters.createProject' }));
    await waitFor(() =>
      expect(net.stream).toHaveBeenCalledWith(expect.objectContaining({ message: 'secureChat.starters.createProject' })),
    );
  });

  it('no ofrece adjuntos: NexusBot sólo recibe texto', async () => {
    renderLive();
    await userEvent.click(screen.getByRole('button', { name: 'secureChat.openLive' }));
    await screen.findByLabelText('secureChat.inputLabel');

    expect(screen.queryByTestId('file-input')).toBeNull();
    expect(screen.queryByRole('button', { name: 'secureChat.attach' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'secureChat.attachFile' })).toBeNull();
  });

  it('un archivo soltado se frena (no navega) y no se adjunta', async () => {
    renderLive();
    await userEvent.click(screen.getByRole('button', { name: 'secureChat.openLive' }));
    const zone = await screen.findByTestId('chat-conversation');
    const drop = new Event('drop', { bubbles: true, cancelable: true });
    Object.defineProperty(drop, 'dataTransfer', {
      value: { types: ['Files'], files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    });
    zone.dispatchEvent(drop);

    expect(drop.defaultPrevented).toBe(true);
    expect(screen.queryByTestId('drop-overlay')).toBeNull();
  });

  it.each([
    [new ApiError('x', 503, 'SERVICE_UNAVAILABLE'), 'secureChat.errors.unavailable'],
    [new ApiError('x', 429, 'RATE_LIMITED'), 'secureChat.errors.rateLimited'],
  ])('si no se puede abrir la sesión, avisa con un mensaje propio (%#)', async (error, message) => {
    api.createSession.mockRejectedValue(error);
    renderLive();
    await openAndSend('hola');

    expect(await screen.findByTestId('chat-notices')).toHaveTextContent(message);
    expect(net.stream).not.toHaveBeenCalled();
  });

  it('un fallo del stream queda como aviso y se puede volver a enviar', async () => {
    net.stream.mockImplementationOnce(async function* () {
      yield* [];
      throw new ChatTransportError('rate-limited');
    });
    renderLive();
    await openAndSend('hola');
    expect(await screen.findByTestId('chat-notices')).toHaveTextContent('secureChat.errors.rateLimited');

    await userEvent.type(screen.getByLabelText('secureChat.inputLabel'), 'otra vez');
    await userEvent.click(screen.getByRole('button', { name: 'secureChat.send' }));
    await waitFor(() => expect(screen.getAllByTestId('message-assistant')).toHaveLength(2));
  });

  it('"Nueva conversación" abre otra sesión en NexusBot', async () => {
    renderLive();
    await openAndSend('uno');
    await screen.findByTestId('message-assistant');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'secureChat.stop' })).toBeNull());
    const first = api.createSession.mock.calls[0][0];

    await userEvent.click(screen.getByRole('button', { name: /secureChat.newConversation/ }));
    await userEvent.type(screen.getByLabelText('secureChat.inputLabel'), 'dos');
    await userEvent.click(screen.getByRole('button', { name: 'secureChat.send' }));

    await waitFor(() => expect(api.createSession).toHaveBeenCalledTimes(2));
    expect(api.createSession.mock.calls[1][0]).not.toBe(first);
  });
});
