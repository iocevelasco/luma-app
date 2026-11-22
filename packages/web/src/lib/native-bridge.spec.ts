import { afterEach, describe, expect, it, vi } from 'vitest';
import { notifyNativeSessionEnded } from './native-bridge';

describe('aviso a la app nativa', () => {
  afterEach(() => {
    delete window.ReactNativeWebView;
  });

  it('en el navegador no hay a quién avisar', () => {
    expect(() => notifyNativeSessionEnded()).not.toThrow();
  });

  it('dentro del WebView avisa que la sesión terminó', () => {
    const postMessage = vi.fn();
    window.ReactNativeWebView = { postMessage };

    notifyNativeSessionEnded();

    expect(postMessage).toHaveBeenCalledWith(JSON.stringify({ type: 'session-ended' }));
  });
});
