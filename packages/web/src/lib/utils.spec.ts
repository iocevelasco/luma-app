import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn()', () => {
  it('returns a single class unchanged', () => {
    expect(cn('bg-red-500')).toBe('bg-red-500');
  });

  it('merges multiple classes', () => {
    expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
  });

  it('resolves Tailwind conflicts — last class wins', () => {
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('resolves padding conflicts', () => {
    expect(cn('p-4', 'px-2')).toBe('p-4 px-2');
    expect(cn('px-2', 'p-4')).toBe('p-4');
  });

  it('ignores falsy values', () => {
    expect(cn('base', false && 'falsy', undefined, null, '')).toBe('base');
  });

  it('supports conditional classes', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
    expect(cn('base', !isActive && 'active')).toBe('base');
  });

  it('supports object syntax', () => {
    expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
  });

  it('returns empty string when no valid classes', () => {
    expect(cn(false, undefined, null)).toBe('');
  });
});
