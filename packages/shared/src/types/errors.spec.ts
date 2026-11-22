import { describe, expect, it } from 'vitest';
import { STATUS_BY_ERROR_CODE, errorCodeForStatus, type ApiErrorCode } from './errors.js';

const codesWithStatus = (status: number) =>
  (Object.entries(STATUS_BY_ERROR_CODE) as [ApiErrorCode, number][])
    .filter(([, mapped]) => mapped === status)
    .map(([code]) => code);

describe('STATUS_BY_ERROR_CODE', () => {
  /**
   * El cliente web lee todo 401 con token como sesión vencida: renueva,
   * reintenta y, si vuelve a fallar, cierra la sesión. Un código que no habla
   * de la sesión y sale con 401 desloguea a quien sólo se equivocó en un campo
   * — fue lo que pasaba al escribir mal la contraseña actual en "Mi cuenta".
   */
  it('sólo los códigos de sesión salen con 401', () => {
    expect(codesWithStatus(401)).toEqual(['UNAUTHENTICATED', 'INVALID_CREDENTIALS']);
  });

  it('una contraseña que no coincide, con sesión, es un 403', () => {
    expect(STATUS_BY_ERROR_CODE.WRONG_PASSWORD).toBe(403);
  });
});

describe('errorCodeForStatus', () => {
  /**
   * Varios códigos comparten status, y a una respuesta armada a mano le toca
   * el primero de la tabla. Sumar un código específico arriba del genérico le
   * cambiaría el `code` a todos los `res.status(403)` que ya existen.
   */
  it.each([
    [400, 'VALIDATION'],
    [401, 'UNAUTHENTICATED'],
    [402, 'SUBSCRIPTION_REQUIRED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
  ] as const)('un %i sin código propio es %s', (status, code) => {
    expect(errorCodeForStatus(status)).toBe(code);
  });

  it('lo que no está en la tabla cae en VALIDATION si es 4xx y en INTERNAL si es 5xx', () => {
    expect(errorCodeForStatus(418)).toBe('VALIDATION');
    expect(errorCodeForStatus(502)).toBe('INTERNAL');
  });
});
