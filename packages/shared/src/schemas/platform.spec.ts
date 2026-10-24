import { describe, expect, it } from 'vitest';
import { platformUsersQuerySchema } from './platform.js';

describe('platformUsersQuerySchema', () => {
  it('completa los valores por defecto', () => {
    expect(platformUsersQuerySchema.parse({})).toEqual({
      filter: 'all',
      q: '',
      page: 1,
      pageSize: 20,
    });
  });

  it('convierte los números que llegan como texto en la URL', () => {
    const parsed = platformUsersQuerySchema.parse({ page: '3', pageSize: '50' });
    expect(parsed.page).toBe(3);
    expect(parsed.pageSize).toBe(50);
  });

  it('rechaza un filtro que no existe y un tamaño de página excesivo', () => {
    expect(platformUsersQuerySchema.safeParse({ filter: 'banned' }).success).toBe(false);
    expect(platformUsersQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});
