import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInvalidationBatcher } from './invalidation-batcher';

describe('createInvalidationBatcher', () => {
  const flush = vi.fn();
  let busy = false;

  beforeEach(() => {
    vi.useFakeTimers();
    flush.mockClear();
    busy = false;
  });
  afterEach(() => vi.useRealTimers());

  function make(extra = {}) {
    return createInvalidationBatcher({
      flush,
      isBusy: () => busy,
      windowMs: 250,
      jitterMs: 0,
      random: () => 0,
      ...extra,
    });
  }

  it('no invalida antes de que cierre la ventana', () => {
    const batcher = make();
    batcher.add(['activities']);
    vi.advanceTimersByTime(249);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledWith(['activities']);
  });

  it('junta una ráfaga en una sola invalidación, sin repetir recursos', () => {
    const batcher = make();
    batcher.add(['activities']);
    vi.advanceTimersByTime(100);
    batcher.add(['materials', 'activities']);
    vi.advanceTimersByTime(150);

    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith(['activities', 'materials']);
  });

  it('suma jitter para repartir los pedidos de quienes miran la misma obra', () => {
    const batcher = make({ jitterMs: 1000, random: () => 0.5 });
    batcher.add(['activities']);
    vi.advanceTimersByTime(250 + 499);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('espera a que termine una mutación en curso para no pisar lo que la persona está haciendo', () => {
    const batcher = make();
    busy = true;
    batcher.add(['activities']);

    vi.advanceTimersByTime(250 + 900);
    expect(flush).not.toHaveBeenCalled();

    busy = false;
    vi.advanceTimersByTime(300);
    expect(flush).toHaveBeenCalledWith(['activities']);
  });

  it('pero no espera para siempre', () => {
    const batcher = make({ maxBusyWaitMs: 2000 });
    busy = true;
    batcher.add(['materials']);

    vi.advanceTimersByTime(250 + 1900);
    expect(flush).not.toHaveBeenCalled();
    vi.advanceTimersByTime(600);
    expect(flush).toHaveBeenCalledWith(['materials']);
  });

  it('cancel descarta lo pendiente', () => {
    const batcher = make();
    batcher.add(['activities']);
    batcher.cancel();
    vi.advanceTimersByTime(5000);
    expect(flush).not.toHaveBeenCalled();
  });

  it('después de invalidar acepta una ráfaga nueva', () => {
    const batcher = make();
    batcher.add(['activities']);
    vi.advanceTimersByTime(250);
    batcher.add(['materials']);
    vi.advanceTimersByTime(250);
    expect(flush).toHaveBeenNthCalledWith(2, ['materials']);
  });
});
