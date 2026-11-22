import { describe, expect, it } from 'vitest';
import { integrationsConfigFromEnv } from '../../controllers/integrations-config.controller.js';
import { publicConfigFromEnv } from '../../controllers/public-config.controller.js';

const ALL_ON = {
  CLIENT_ID: 'client.apps.googleusercontent.com',
  PICKER_API_KEY: 'browser-key',
  PROJECT_NUMBER: '1234',
  MAPS_BROWSER_KEY: 'maps-key',
  LOGIN_ENABLED: true,
  DRIVE_ENABLED: true,
};

const ALL_OFF = {
  CLIENT_ID: undefined,
  PICKER_API_KEY: undefined,
  PROJECT_NUMBER: undefined,
  MAPS_BROWSER_KEY: undefined,
  LOGIN_ENABLED: false,
  DRIVE_ENABLED: false,
};

describe('publicConfigFromEnv (sin sesión)', () => {
  it('sólo sale el client id del botón de Google: ninguna clave de API', () => {
    expect(publicConfigFromEnv(ALL_ON)).toEqual({
      googleLogin: { clientId: 'client.apps.googleusercontent.com' },
    });
  });

  it('sin client id, el login con Google va en null', () => {
    expect(publicConfigFromEnv(ALL_OFF).googleLogin).toBeNull();
  });
});

describe('integrationsConfigFromEnv (con sesión)', () => {
  it('con todo configurado, Maps y Drive llegan completos', () => {
    expect(integrationsConfigFromEnv(ALL_ON)).toEqual({
      maps: { apiKey: 'maps-key' },
      drive: { clientId: 'client.apps.googleusercontent.com', apiKey: 'browser-key', appId: '1234' },
    });
  });

  it('si falta algo de Drive, Drive va en null y la UI no lo ofrece; sin clave de Maps, Maps también', () => {
    const partial = integrationsConfigFromEnv({ ...ALL_ON, PICKER_API_KEY: undefined, DRIVE_ENABLED: false, MAPS_BROWSER_KEY: undefined });
    expect(partial.drive).toBeNull();
    expect(partial.maps).toBeNull();
  });
});
