import type { TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api-client';
import { errorMessage } from './error-message';

const t = ((key: string) => key) as unknown as TFunction;

describe('errorMessage', () => {
  it('un login que no coincide no dice que se cerró la sesión', () => {
    const error = new ApiError('Email o contraseña incorrectos', 401, 'INVALID_CREDENTIALS');
    expect(errorMessage(error, t)).toBe('errors.invalidCredentials');
  });

  it('una sesión vencida sigue diciendo que se cerró', () => {
    const error = new ApiError('No token provided', 401, 'UNAUTHENTICATED');
    expect(errorMessage(error, t)).toBe('errors.unauthenticated');
  });
});
