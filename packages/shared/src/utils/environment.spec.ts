import { describe, expect, it } from 'vitest';
import {
  getApiBaseUrl,
  getEnvironment,
  isDevelopment,
  isLocalhost,
  isProduction,
  shouldEnableRecaptcha,
} from './environment.js';

describe('environment', () => {
  it('reconoce localhost y rangos de red privada', () => {
    expect(isLocalhost('localhost')).toBe(true);
    expect(isLocalhost('127.0.0.1')).toBe(true);
    expect(isLocalhost('192.168.1.20')).toBe(true);
    expect(isLocalhost('example.com')).toBe(false);
    expect(isLocalhost(null)).toBe(false);
  });

  it('nunca considera producción a un host local', () => {
    expect(isProduction('localhost')).toBe(false);
    expect(isDevelopment('localhost')).toBe(true);
  });

  it('usa NODE_ENV cuando no hay hostname local', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    expect(isProduction('example.com')).toBe(true);
    process.env.NODE_ENV = previous;
  });

  it('devuelve el dev URL fuera de producción', () => {
    expect(getApiBaseUrl('http://localhost:9999')).toBe('http://localhost:9999');
  });

  it('marca el entorno de test', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    expect(getEnvironment()).toBe('test');
    process.env.NODE_ENV = previous;
  });

  it('desactiva reCAPTCHA en localhost', () => {
    expect(shouldEnableRecaptcha('localhost')).toBe(false);
  });
});
