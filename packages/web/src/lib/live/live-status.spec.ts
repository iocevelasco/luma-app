import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { setLiveStatus, useLiveStatus } from './live-status';

afterEach(() => setLiveStatus('off'));

describe('useLiveStatus', () => {
  it('arranca en `off` y sigue al canal', () => {
    const { result } = renderHook(() => useLiveStatus());
    expect(result.current).toBe('off');

    act(() => setLiveStatus('live'));
    expect(result.current).toBe('live');

    act(() => setLiveStatus('retrying'));
    expect(result.current).toBe('retrying');
  });

  it('avisa a todos los que lo leen', () => {
    const a = renderHook(() => useLiveStatus());
    const b = renderHook(() => useLiveStatus());

    act(() => setLiveStatus('live'));

    expect(a.result.current).toBe('live');
    expect(b.result.current).toBe('live');
  });
});
