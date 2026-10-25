import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, ActivityListResponse } from '@luma/shared';
import { QueryKeys } from '@/lib/query-keys';
import { useMoveActivity, useRescheduleActivity } from './use-activity-queries';

const { update, toastSuccess, toastError } = vi.hoisted(() => ({
  update: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/api/activities', () => ({ activitiesApi: { update } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess, error: toastError } }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));

const PROJECT = 'p1';
const KEY = [QueryKeys.activities, PROJECT, 'all'];

const activity: Activity = {
  id: 'a1',
  projectId: PROJECT,
  name: 'Hormigonar',
  startDate: '2026-10-12',
  endDate: '2026-10-14',
  responsible: { name: 'Juan Pérez' },
  status: 'pendiente',
  evidence: [],
  createdBy: 'u1',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData<ActivityListResponse>(KEY, { activities: [activity] } as ActivityListResponse);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const cached = () => queryClient.getQueryData<ActivityListResponse>(KEY)!.activities[0];
  return { queryClient, wrapper, cached };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('las mutaciones optimistas de una actividad', () => {
  // Mover una tarjeta o una barra del Cronograma tiene que verse en el cuadro en que
  // se suelta. Si `onMutate` espera a `cancelQueries` antes de escribir la caché, la
  // tarjeta se queda un instante en su lugar de origen (o la barra, sin moverse).
  it.each([
    {
      hook: 'useMoveActivity',
      run: (wrapper: ReturnType<typeof setup>['wrapper']) => {
        const { result } = renderHook(() => useMoveActivity(PROJECT), { wrapper });
        return () => result.current.mutate({ activityId: 'a1', status: 'en_curso' });
      },
      moved: { status: 'en_curso' },
    },
    {
      hook: 'useRescheduleActivity',
      run: (wrapper: ReturnType<typeof setup>['wrapper']) => {
        const { result } = renderHook(() => useRescheduleActivity(PROJECT), { wrapper });
        return () =>
          result.current.mutate({ activityId: 'a1', startDate: '2026-10-20', endDate: '2026-10-22' });
      },
      moved: { startDate: '2026-10-20', endDate: '2026-10-22' },
    },
  ])('$hook escribe la caché sin esperar a que se cancelen las consultas', async ({ run, moved }) => {
    const { queryClient, wrapper, cached } = setup();
    // La cancelación queda colgada: lo que se ve en la caché no puede depender de ella.
    vi.spyOn(queryClient, 'cancelQueries').mockReturnValue(new Promise(() => {}));
    update.mockReturnValue(new Promise(() => {}));

    const mutate = run(wrapper);
    act(() => mutate());

    await waitFor(() => expect(cached()).toMatchObject(moved));
  });
});

describe('useRescheduleActivity', () => {
  const reschedule = { activityId: 'a1', startDate: '2026-10-20', endDate: '2026-10-22' };

  it('avisa con un toast de éxito', async () => {
    const { wrapper } = setup();
    update.mockResolvedValue({ activity });
    const { result } = renderHook(() => useRescheduleActivity(PROJECT), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(reschedule);
    });

    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('si la API lo rechaza, la barra vuelve a sus fechas y se avisa por toast', async () => {
    const { wrapper, cached } = setup();
    update.mockRejectedValue(new Error('no'));
    const { result } = renderHook(() => useRescheduleActivity(PROJECT), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(reschedule).catch(() => undefined);
    });

    expect(cached()).toMatchObject({ startDate: '2026-10-12', endDate: '2026-10-14' });
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
