import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  LIST_POLL_MS,
  LIVE_BACKUP_POLL_MS,
  keepWhileMutating,
  optimisticActivityMutationKey,
  polledList,
} from './query-freshness';

describe('polledList', () => {
  it('sin canal en vivo pide cada 30 s', () => {
    expect(polledList().refetchInterval).toBe(LIST_POLL_MS);
    expect(polledList(false).refetchInterval).toBe(LIST_POLL_MS);
  });

  it('con el canal en vivo sano espacia el polling al respaldo', () => {
    expect(polledList(true).refetchInterval).toBe(LIVE_BACKUP_POLL_MS);
    expect(LIVE_BACKUP_POLL_MS).toBeGreaterThan(LIST_POLL_MS);
  });

  it('nunca pollea en segundo plano', () => {
    expect(polledList(true).refetchIntervalInBackground).toBe(false);
    expect(polledList(false).refetchIntervalInBackground).toBe(false);
  });
});

describe('keepWhileMutating', () => {
  const queryKey = ['activities', 'p1', 'all'];
  const mutationKey = optimisticActivityMutationKey('p1');

  function startPendingMutation(queryClient: QueryClient, key: readonly unknown[]) {
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationKey: key,
      mutationFn: () => new Promise<void>(() => {}),
    });
    void mutation.execute(undefined);
  }

  it('sin mutación optimista en vuelo, deja pasar lo que llegó', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKey, 'optimista');
    expect(keepWhileMutating(queryClient, queryKey, mutationKey, 'del servidor')).toBe('del servidor');
  });

  it('con una mutación optimista en vuelo, conserva la caché y no la pisa con un dato anterior', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKey, 'optimista');
    startPendingMutation(queryClient, mutationKey);

    expect(keepWhileMutating(queryClient, queryKey, mutationKey, 'del servidor')).toBe('optimista');
  });

  it('sin nada en caché, usa lo que llegó aunque haya una mutación', () => {
    const queryClient = new QueryClient();
    startPendingMutation(queryClient, mutationKey);

    expect(keepWhileMutating(queryClient, queryKey, mutationKey, 'del servidor')).toBe('del servidor');
  });

  it('una mutación de otra obra o de otro tipo no frena el refetch', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKey, 'optimista');
    startPendingMutation(queryClient, optimisticActivityMutationKey('otra-obra'));
    startPendingMutation(queryClient, ['crear-material']);

    expect(keepWhileMutating(queryClient, queryKey, mutationKey, 'del servidor')).toBe('del servidor');
  });
});
