import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Dar acceso a varias obras es N invitaciones independientes. Lo que importa
 * probar es cómo se reparte el resultado: un 409 NO es una falla (la persona
 * ya tenía acceso, que es lo que se pedía) y un error en una obra no tira
 * abajo a las demás.
 */
const inviteMember = vi.fn();

vi.mock('@/api/projects', () => ({ projectsApi: { inviteMember } }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { ApiError } = await import('@/lib/api-client');
const { useGrantProjectAccess } = await import('./use-project-queries');
const { toast } = await import('sonner');

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useGrantProjectAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cuenta el 409 como "ya tenía acceso" y no como falla', async () => {
    inviteMember
      .mockResolvedValueOnce({ member: {} })
      .mockRejectedValueOnce(new ApiError('Esa persona ya tiene acceso a la obra', 409, 'CONFLICT'));

    const { result } = renderHook(() => useGrantProjectAccess(), { wrapper });
    let results: Awaited<ReturnType<typeof result.current.mutateAsync>> = [];
    await act(async () => {
      results = await result.current.mutateAsync({
        email: 'ana@estudio.com',
        role: 'supervisor',
        projectIds: ['p1', 'p2'],
      });
    });

    expect(results.map((r) => r.status)).toEqual(['granted', 'already']);
    expect(toast.success).toHaveBeenCalled();
  });

  it('una obra que falla no frena a las otras y no muestra el toast de éxito', async () => {
    inviteMember
      .mockRejectedValueOnce(new ApiError('Sin permiso', 403, 'FORBIDDEN'))
      .mockResolvedValueOnce({ member: {} });

    const { result } = renderHook(() => useGrantProjectAccess(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({
        email: 'ana@estudio.com',
        role: 'contador',
        projectIds: ['p1', 'p2'],
      });
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.map((r) => r.status)).toEqual(['failed', 'granted']);
    expect(result.current.data![0]!.message).toBe('Sin permiso');
    expect(inviteMember).toHaveBeenCalledTimes(2);
    expect(toast.success).not.toHaveBeenCalled();
  });
});
