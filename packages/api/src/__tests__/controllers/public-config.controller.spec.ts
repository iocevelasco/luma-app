import { describe, expect, it } from 'vitest';
import { publicConfigFromEnv } from '../../controllers/public-config.controller.js';

describe('publicConfigFromEnv', () => {
  it('con las tres variables, Drive llega completo a la SPA', () => {
    expect(
      publicConfigFromEnv({
        CLIENT_ID: 'client.apps.googleusercontent.com',
        PICKER_API_KEY: 'browser-key',
        PROJECT_NUMBER: '1234',
        MAPS_BROWSER_KEY: 'maps-key',
        LOGIN_ENABLED: true,
        DRIVE_ENABLED: true,
      }),
    ).toEqual({
      googleLogin: { clientId: 'client.apps.googleusercontent.com' },
      maps: { apiKey: 'maps-key' },
      drive: { clientId: 'client.apps.googleusercontent.com', apiKey: 'browser-key', appId: '1234' },
    });
  });

  it('si falta alguna, Drive va en null y la UI no lo ofrece', () => {
    expect(
      publicConfigFromEnv({
        CLIENT_ID: 'client',
        PICKER_API_KEY: undefined,
        PROJECT_NUMBER: '1234',
        MAPS_BROWSER_KEY: undefined,
        LOGIN_ENABLED: true,
        DRIVE_ENABLED: false,
      }).drive,
    ).toBeNull();
  });

  it('el login con Google sólo necesita el client id; sin él va en null', () => {
    const off = publicConfigFromEnv({
      CLIENT_ID: undefined,
      PICKER_API_KEY: undefined,
      PROJECT_NUMBER: undefined,
      MAPS_BROWSER_KEY: undefined,
      LOGIN_ENABLED: false,
      DRIVE_ENABLED: false,
    });
    expect(off.googleLogin).toBeNull();
    expect(off.maps).toBeNull();
  });
});
