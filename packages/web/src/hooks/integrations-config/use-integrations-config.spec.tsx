import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Las claves de Maps y Drive se piden sólo con sesión. Sin ella, un 401 en una
 * pantalla pública (login, registro) patea a /login y rompe el flujo.
 */
const auth = { isAuthenticated: false };
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => auth }));
vi.mock('@/api/integrations-config', () => ({
  integrationsConfigApi: { get: vi.fn().mockResolvedValue({ maps: { apiKey: 'k' }, drive: null }) },
}));

const { integrationsConfigApi } = await import('@/api/integrations-config');
const { useIntegrationsConfig } = await import('./use-integrations-config');

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe('useIntegrationsConfig', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sin sesión no pide nada', async () => {
    auth.isAuthenticated = false;
    const { result } = renderHook(() => useIntegrationsConfig(), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(integrationsConfigApi.get).not.toHaveBeenCalled();
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('con sesión trae las claves', async () => {
    auth.isAuthenticated = true;
    const { result } = renderHook(() => useIntegrationsConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ maps: { apiKey: 'k' }, drive: null });
  });
});
