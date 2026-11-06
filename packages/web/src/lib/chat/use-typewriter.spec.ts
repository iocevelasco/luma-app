import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTypewriter } from './use-typewriter';

function mockMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }));
}

describe('useTypewriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('escribe el texto letra por letra y termina completo', () => {
    mockMotion(false);
    const { result } = renderHook(() => useTypewriter('Hola'));
    expect(result.current).toEqual({ visible: '', typing: true });

    act(() => void vi.advanceTimersByTime(400));
    expect(result.current.visible).toBe('H');

    act(() => void vi.advanceTimersByTime(55 * 3));
    expect(result.current).toEqual({ visible: 'Hola', typing: false });
  });

  it('con movimiento reducido muestra el texto completo de una vez', () => {
    mockMotion(true);
    const { result } = renderHook(() => useTypewriter('Hola'));
    expect(result.current).toEqual({ visible: 'Hola', typing: false });
  });

  it('sin matchMedia en el entorno anima igual, sin romper', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useTypewriter('Hola'));
    expect(result.current.typing).toBe(true);
  });

  it('desactivado devuelve el texto completo', () => {
    mockMotion(false);
    const { result } = renderHook(() => useTypewriter('Hola', false));
    expect(result.current).toEqual({ visible: 'Hola', typing: false });
  });
});
