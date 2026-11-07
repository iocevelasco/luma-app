import { describe, expect, it } from 'vitest';
import { LIVE_RESOURCES } from '@luma/shared';
import { QueryKeys } from '@/lib/query-keys';
import { LIVE_QUERY_KEYS, liveQueryKeysFor } from './live-query-keys';

describe('LIVE_QUERY_KEYS', () => {
  it('cada recurso en vivo dice qué queries refresca', () => {
    for (const resource of LIVE_RESOURCES) {
      expect(LIVE_QUERY_KEYS[resource].length).toBeGreaterThan(0);
    }
  });

  it('nunca invalida las fotos ni los archivos: pesan y no cambian por un aviso', () => {
    const all = LIVE_RESOURCES.flatMap((resource) => LIVE_QUERY_KEYS[resource]);
    expect(all).not.toContain(QueryKeys.materialPhoto);
    expect(all).not.toContain(QueryKeys.projectDocumentFile);
  });

  it('arma claves [query, projectId] que matchean por prefijo las de los hooks', () => {
    expect(liveQueryKeysFor(['activities', 'materials'], 'p1')).toEqual([
      [QueryKeys.activities, 'p1'],
      [QueryKeys.materials, 'p1'],
    ]);
  });
});
