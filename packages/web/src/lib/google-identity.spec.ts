import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clampButtonWidth,
  googleButtonLocale,
  renderGoogleButton,
  setGoogleCredentialHandler,
} from './google-identity';

describe('clampButtonWidth', () => {
  it('se queda entre los 200 y 400 px que acepta Google', () => {
    expect(clampButtonWidth(120)).toBe(200);
    expect(clampButtonWidth(320.6)).toBe(321);
    expect(clampButtonWidth(900)).toBe(400);
  });
});

describe('googleButtonLocale', () => {
  it.each([
    ['es-ES', 'es'],
    ['es-AR', 'es-419'],
    ['pt', 'pt-BR'],
    [undefined, 'es'],
  ])('%s → %s', (language, locale) => {
    expect(googleButtonLocale(language)).toBe(locale);
  });
});

describe('renderGoogleButton', () => {
  afterEach(() => {
    delete window.google;
    setGoogleCredentialHandler(null);
  });

  it('sin el script de Google no dibuja nada: queda la contraseña', () => {
    expect(renderGoogleButton('client', document.createElement('div'), {
      text: 'signin_with',
      width: 300,
      locale: 'es',
    })).toBe(false);
  });

  it('inicializa una sola vez y entrega la credencial a la pantalla montada', () => {
    let callback: ((response: { credential?: string }) => void) | undefined;
    const initialize = vi.fn((config: { callback: typeof callback }) => {
      callback = config.callback;
    });
    const renderButton = vi.fn();
    window.google = { accounts: { id: { initialize, renderButton } } } as never;

    const parent = document.createElement('div');
    const options = { text: 'signin_with' as const, width: 999, locale: 'es' };
    renderGoogleButton('client-a', parent, options);
    renderGoogleButton('client-a', parent, options);

    expect(initialize).toHaveBeenCalledTimes(1);
    expect(renderButton).toHaveBeenLastCalledWith(
      parent.firstElementChild,
      expect.objectContaining({ theme: 'outline', size: 'large', width: 400 }),
    );

    const handler = vi.fn();
    setGoogleCredentialHandler(handler);
    callback?.({ credential: 'id-token' });
    expect(handler).toHaveBeenCalledWith('id-token');
  });

  it('un dibujo anterior que llega tarde no suma un segundo botón', () => {
    // Google inserta el iframe después de `renderButton`, no en el momento.
    const pending: Array<() => void> = [];
    const renderButton = vi.fn((target: HTMLElement) => {
      pending.push(() => target.append(document.createElement('iframe')));
    });
    window.google = { accounts: { id: { initialize: vi.fn(), renderButton } } } as never;

    const parent = document.createElement('div');
    renderGoogleButton('client-b', parent, { text: 'signin_with', width: 300, locale: 'es' });
    renderGoogleButton('client-b', parent, { text: 'signin_with', width: 320, locale: 'es' });
    pending.forEach((insert) => insert());

    expect(parent.querySelectorAll('iframe')).toHaveLength(1);
  });
});
