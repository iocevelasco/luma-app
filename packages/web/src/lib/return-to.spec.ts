import { describe, it, expect } from 'vitest';
import {
  sanitizeReturnTo,
  readReturnTo,
  buildLoginPathWithReturn,
  RETURN_TO_PARAM,
} from './return-to';

describe('sanitizeReturnTo()', () => {
  it('accepts a plain internal path', () => {
    expect(sanitizeReturnTo('/admin')).toBe('/admin');
    expect(sanitizeReturnTo('/admin?tab=x')).toBe('/admin?tab=x');
    expect(sanitizeReturnTo('/')).toBe('/');
    expect(sanitizeReturnTo('/admin')).toBe('/admin');
  });

  it('rejects protocol-relative URLs (open-redirect)', () => {
    expect(sanitizeReturnTo('//evil.com')).toBeNull();
    expect(sanitizeReturnTo('//evil.com/admin')).toBeNull();
  });

  it('rejects backslash-tricked URLs that browsers resolve as external', () => {
    expect(sanitizeReturnTo('/\\evil.com')).toBeNull();
    expect(sanitizeReturnTo('/\\/evil.com')).toBeNull();
  });

  it('rejects absolute URLs with a scheme', () => {
    expect(sanitizeReturnTo('https://evil.com')).toBeNull();
    expect(sanitizeReturnTo('http://evil.com')).toBeNull();
    expect(sanitizeReturnTo('javascript:alert(1)')).toBeNull();
  });

  it('rejects paths that do not start with a single slash', () => {
    expect(sanitizeReturnTo('checkin')).toBeNull();
    expect(sanitizeReturnTo('')).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
    expect(sanitizeReturnTo(undefined)).toBeNull();
  });
});

describe('readReturnTo()', () => {
  it('extracts and sanitizes the returnTo param from a search string', () => {
    const search = `?${RETURN_TO_PARAM}=${encodeURIComponent('/admin?tab=x')}`;
    expect(readReturnTo(search)).toBe('/admin?tab=x');
  });

  it('returns null when the param is missing', () => {
    expect(readReturnTo('?foo=bar')).toBeNull();
    expect(readReturnTo('')).toBeNull();
  });

  it('rejects an external returnTo carried in the query', () => {
    const search = `?${RETURN_TO_PARAM}=${encodeURIComponent('//evil.com')}`;
    expect(readReturnTo(search)).toBeNull();
  });
});

describe('buildLoginPathWithReturn()', () => {
  it('appends the current internal path as an encoded returnTo', () => {
    const path = buildLoginPathWithReturn('/login', '/admin?tab=x');
    expect(path).toBe(`/login?${RETURN_TO_PARAM}=${encodeURIComponent('/admin?tab=x')}`);
    // Round-trips cleanly back to the original path.
    expect(readReturnTo(path.slice(path.indexOf('?')))).toBe('/admin?tab=x');
  });

  it('falls back to the bare login path for an unsafe destination', () => {
    expect(buildLoginPathWithReturn('/login', '//evil.com')).toBe('/login');
    expect(buildLoginPathWithReturn('/login', 'https://evil.com')).toBe('/login');
  });
});
