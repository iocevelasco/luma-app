import { describe, expect, it } from 'vitest';
import { publicConfigFromEnv } from '../../controllers/public-config.controller.js';

describe('publicConfigFromEnv', () => {
  it('con las tres variables, Drive llega completo a la SPA', () => {
    expect(
      publicConfigFromEnv({
        CLIENT_ID: 'client.apps.googleusercontent.com',
        PICKER_API_KEY: 'browser-key',
        PROJECT_NUMBER: '1234',
        DRIVE_ENABLED: true,
      }),
    ).toEqual({
      drive: { clientId: 'client.apps.googleusercontent.com', apiKey: 'browser-key', appId: '1234' },
    });
  });

  it('si falta alguna, Drive va en null y la UI no lo ofrece', () => {
    expect(
      publicConfigFromEnv({
        CLIENT_ID: 'client',
        PICKER_API_KEY: undefined,
        PROJECT_NUMBER: '1234',
        DRIVE_ENABLED: false,
      }).drive,
    ).toBeNull();
  });
});
