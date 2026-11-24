import { describe, expect, it } from 'vitest';
import { appEntryUrl, forgotPasswordUrl, isLoginUrl, loginUrl, resolveWebTarget } from './urls';

describe('destino de la web', () => {
  it('en local la API y la SPA comparten el origen pelado', () => {
    const target = resolveWebTarget('http://192.168.1.10:6173');
    expect(loginUrl(target)).toBe('http://192.168.1.10:6173/api/auth/login');
    expect(appEntryUrl(target)).toBe('http://192.168.1.10:6173/admin');
    expect(forgotPasswordUrl(target)).toBe('http://192.168.1.10:6173/forgot-password');
    expect(isLoginUrl('http://192.168.1.10:6173/login', target)).toBe(true);
    expect(isLoginUrl('http://192.168.1.10:6173/admin', target)).toBe(false);
  });

  it('en producción la SPA vive bajo /app y la API en el origen', () => {
    const target = resolveWebTarget('https://luma.example/app/');
    expect(target).toEqual({ origin: 'https://luma.example', base: '/app' });
    expect(loginUrl(target)).toBe('https://luma.example/api/auth/login');
    expect(appEntryUrl(target)).toBe('https://luma.example/app/admin');
    expect(isLoginUrl('https://luma.example/app/login?from=/admin', target)).toBe(true);
    expect(isLoginUrl('https://luma.example/login', target)).toBe(false);
  });

  it('EXPO_PUBLIC_WEB_BASE pisa el path del origen', () => {
    const target = resolveWebTarget('https://luma.example', '/app');
    expect(appEntryUrl(target)).toBe('https://luma.example/app/admin');
  });
});
