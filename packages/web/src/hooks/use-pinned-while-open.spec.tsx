import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePinnedWhileOpen } from './use-pinned-while-open';

describe('usePinnedWhileOpen', () => {
  it('con el panel cerrado sigue al dato vivo', () => {
    const { result, rerender } = renderHook(({ value, open }) => usePinnedWhileOpen(value, open), {
      initialProps: { value: { name: 'A' }, open: false },
    });
    expect(result.current.name).toBe('A');

    rerender({ value: { name: 'B' }, open: false });
    expect(result.current.name).toBe('B');
  });

  it('al abrir toma el dato de ese momento y no lo suelta hasta cerrar', () => {
    const { result, rerender } = renderHook(({ value, open }) => usePinnedWhileOpen(value, open), {
      initialProps: { value: { name: 'A' }, open: false },
    });

    rerender({ value: { name: 'B' }, open: true });
    expect(result.current.name).toBe('B');

    // Otra persona lo cambia mientras el formulario está abierto.
    rerender({ value: { name: 'C' }, open: true });
    expect(result.current.name).toBe('B');

    rerender({ value: { name: 'D' }, open: true });
    expect(result.current.name).toBe('B');
  });

  it('al cerrar vuelve al dato vivo, y la próxima apertura arranca de lo último', () => {
    const { result, rerender } = renderHook(({ value, open }) => usePinnedWhileOpen(value, open), {
      initialProps: { value: { name: 'A' }, open: true },
    });
    rerender({ value: { name: 'B' }, open: true });
    expect(result.current.name).toBe('A');

    rerender({ value: { name: 'B' }, open: false });
    expect(result.current.name).toBe('B');

    rerender({ value: { name: 'C' }, open: true });
    expect(result.current.name).toBe('C');
  });
});
