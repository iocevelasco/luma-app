import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIST_POLL_MS, LIST_STALE_MS } from '@/lib/query-freshness';
import { QueryKeys } from '@/lib/query-keys';

/**
 * Todo el inventario se refresca como el resto de las listas de obra: vence a
 * los 30 s y se vuelve a pedir cada 30 s mientras se mira. No usa el canal en
 * vivo, así que si una de estas lecturas perdiera el polling, otra persona
 * podría despachar y esta pantalla no enterarse nunca.
 */
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ isAuthenticated: true }) }));
vi.mock('@/api/inventory', () => ({
  inventoryApi: {
    stock: vi.fn().mockResolvedValue({ items: [] }),
    movements: vi.fn().mockResolvedValue({ movements: [] }),
    deposit: vi.fn().mockResolvedValue({ lines: [] }),
    myDeposit: vi.fn().mockResolvedValue({ lines: [], movements: [], savings: [] }),
  },
}));

const { useDepositForImport, useMyDeposit, useStock, useStockMovements } = await import(
  './use-inventory-queries'
);

function setup() {
  const queryClient = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

function optionsOf(queryClient: QueryClient, key: QueryKeys) {
  const query = queryClient.getQueryCache().getAll().find((candidate) => candidate.queryKey[0] === key);
  expect(query, `no se pidió ${key}`).toBeDefined();
  // La frescura la fija quien observa la query, no la query en sí.
  return query!.observers[0]!.options;
}

describe('frescura de las lecturas del inventario', () => {
  const cases: [string, QueryKeys, () => { isSuccess: boolean }][] = [
    ['el stock', QueryKeys.stock, () => useStock('p1')],
    ['el kardex', QueryKeys.stockMovements, () => useStockMovements('p1', {})],
    ['lo importable del Depósito', QueryKeys.deposit, () => useDepositForImport('p1', true)],
    ['el Depósito de la Empresa', QueryKeys.myDeposit, () => useMyDeposit()],
  ];

  it.each(cases)('%s vence a los 30 s y se vuelve a pedir cada 30 s, sin polling en segundo plano', async (_name, key, hook) => {
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(hook, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const options = optionsOf(queryClient, key);
    expect(options.staleTime).toBe(LIST_STALE_MS);
    expect(options.refetchInterval).toBe(LIST_POLL_MS);
    expect(options.refetchIntervalInBackground).toBe(false);
  });

  it('lo importable del Depósito no se pide con el panel cerrado', async () => {
    const { inventoryApi } = await import('@/api/inventory');
    vi.mocked(inventoryApi.deposit).mockClear();
    const { wrapper } = setup();
    const { result } = renderHook(() => useDepositForImport('p1', false), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(inventoryApi.deposit).not.toHaveBeenCalled();
  });
});
