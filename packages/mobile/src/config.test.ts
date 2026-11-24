import { describe, expect, it } from 'vitest';
import { readConfig } from './config';

describe('configuración de la app', () => {
  it('arma el destino de producción con las variables de Expo', () => {
    expect(
      readConfig({
        EXPO_PUBLIC_WEB_ORIGIN: 'https://luma-app.site/app',
        EXPO_PUBLIC_MOBILE_CLIENT_KEY: 'clave',
      }),
    ).toEqual({
      target: { origin: 'https://luma-app.site', base: '/app' },
      clientKey: 'clave',
    });
  });

  it('avisa si falta el origen', () => {
    expect(
      readConfig({
        EXPO_PUBLIC_WEB_ORIGIN: ' ',
        EXPO_PUBLIC_MOBILE_CLIENT_KEY: 'clave',
      }),
    ).toEqual({ error: 'Falta EXPO_PUBLIC_WEB_ORIGIN.' });
  });
});
