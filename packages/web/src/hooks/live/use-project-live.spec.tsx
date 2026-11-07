import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryKeys } from '@/lib/query-keys';
import { setLiveStatus, useLiveStatus } from '@/lib/live/live-status';
import type { LiveConnectionOptions } from '@/lib/live/live-connection';

/**
 * El hook une la conexión viva con el navegador: qué eventos escucha, cuándo
 * abre y cierra, qué invalida y qué deja dicho en `<html>`. La conexión y el
 * batcher tienen sus propios tests; acá se prueba el cableado, con una
 * conexión falsa.
 */
const auth = vi.hoisted(() => ({ isAuthenticated: true }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('@/api/live', () => ({ liveApi: { open: vi.fn() } }));

const connections = vi.hoisted(() => [] as FakeConnection[]);
interface FakeConnection {
  options: LiveConnectionOptions;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  show: ReturnType<typeof vi.fn>;
}
vi.mock('@/lib/live/live-connection', () => ({
  createLiveConnection: (options: LiveConnectionOptions) => {
    const connection = { options, start: vi.fn(), stop: vi.fn(), hide: vi.fn(), show: vi.fn() };
    connections.push(connection);
    return connection;
  },
}));

const { useProjectLive } = await import('./use-project-live');

function setup(projectId: string | null = 'p1') {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(({ id }) => useProjectLive(id ?? undefined), {
    wrapper,
    initialProps: { id: projectId },
  });
  return { queryClient, invalidate, ...hook };
}

const last = () => connections.at(-1)!;

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

beforeEach(() => {
  vi.useFakeTimers();
  connections.length = 0;
  auth.isAuthenticated = true;
  setVisibility('visible');
});

afterEach(() => {
  vi.useRealTimers();
  setLiveStatus('off');
});

describe('useProjectLive', () => {
  it('abre la conexión con sesión y obra', () => {
    setup();
    expect(connections).toHaveLength(1);
    expect(last().start).toHaveBeenCalledOnce();
  });

  it('sin sesión o sin obra no abre nada', () => {
    auth.isAuthenticated = false;
    setup();
    expect(connections).toHaveLength(0);

    auth.isAuthenticated = true;
    setup(null);
    expect(connections).toHaveLength(0);
  });

  it('si la pestaña ya está oculta al montar, lo avisa a la conexión', () => {
    setVisibility('hidden');
    setup();
    expect(last().hide).toHaveBeenCalledOnce();
  });

  it('pasa a segundo plano y vuelve', () => {
    setup();

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(last().hide).toHaveBeenCalledOnce();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(last().show).toHaveBeenCalledWith();
  });

  it('el foco reanuda una conexión pausada', () => {
    setup();
    window.dispatchEvent(new Event('focus'));
    expect(last().show).toHaveBeenCalledWith();
  });

  it('volver la red fuerza una conexión nueva', () => {
    setup();
    window.dispatchEvent(new Event('online'));
    expect(last().show).toHaveBeenCalledWith({ force: true });
  });

  it('volver del bfcache (`persisted`) fuerza una conexión nueva; una carga normal no', () => {
    setup();
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }));
    expect(last().show).toHaveBeenLastCalledWith({ force: true });

    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: false }));
    expect(last().show).toHaveBeenLastCalledWith({ force: false });
  });

  it('`pagehide` la manda a segundo plano', () => {
    setup();
    window.dispatchEvent(new Event('pagehide'));
    expect(last().hide).toHaveBeenCalledOnce();
  });

  it('un aviso invalida la caché de esa obra, agrupado y sin tocar los archivos', () => {
    const { invalidate } = setup('p1');

    last().options.onInvalidate(['activities'], 'event');
    last().options.onInvalidate(['materials', 'activities'], 'event');
    expect(invalidate).not.toHaveBeenCalled(); // espera a que cierre la ventana

    vi.advanceTimersByTime(1500);

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual([
      [QueryKeys.activities, 'p1'],
      [QueryKeys.materials, 'p1'],
    ]);
    expect(invalidate.mock.calls.every(([, options]) => options?.cancelRefetch === false)).toBe(true);
  });

  it('con una mutación en curso espera antes de invalidar', () => {
    const { invalidate, queryClient } = setup('p1');
    let busy = 1;
    vi.spyOn(queryClient, 'isMutating').mockImplementation(() => busy);

    last().options.onInvalidate(['activities'], 'event');
    vi.advanceTimersByTime(1500);
    expect(invalidate).not.toHaveBeenCalled();

    busy = 0;
    vi.advanceTimersByTime(400);
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it('deja el estado del canal en `<html>` y en el store que lee el polling', () => {
    setup();
    const status = renderHook(() => useLiveStatus());

    act(() => last().options.onStatus?.('live'));

    expect(document.documentElement.dataset.liveStatus).toBe('live');
    expect(status.result.current).toBe('live');
  });

  it('al desmontar corta la conexión, quita los listeners y deja el estado en `off`', () => {
    const { unmount, invalidate } = setup();
    act(() => last().options.onStatus?.('live'));
    last().options.onInvalidate(['activities'], 'event');

    act(() => unmount());

    expect(last().stop).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.liveStatus).toBeUndefined();
    const status = renderHook(() => useLiveStatus());
    expect(status.result.current).toBe('off');

    // Lo pendiente se descarta y los eventos del navegador ya no llegan.
    vi.advanceTimersByTime(5000);
    expect(invalidate).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('online'));
    expect(last().show).not.toHaveBeenCalled();
  });

  it('al cambiar de obra cierra la conexión anterior y abre otra', () => {
    const { rerender } = setup('p1');
    const first = last();

    rerender({ id: 'p2' });

    expect(first.stop).toHaveBeenCalledOnce();
    expect(connections).toHaveLength(2);
    expect(last().start).toHaveBeenCalledOnce();
  });
});
