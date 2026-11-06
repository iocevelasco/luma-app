import { describe, expect, it } from 'vitest';
import { platformFollowUpQuerySchema, platformUsersQuerySchema } from './platform.js';

describe('platformFollowUpQuerySchema', () => {
  it('completa los valores por defecto', () => {
    expect(platformFollowUpQuerySchema.parse({})).toEqual({
      filter: 'all',
      q: '',
      page: 1,
      pageSize: 20,
    });
  });

  it('acepta cada filtro y rechaza uno que no existe', () => {
    for (const filter of ['all', 'risk', 'trial', 'paying', 'expired']) {
      expect(platformFollowUpQuerySchema.parse({ filter }).filter).toBe(filter);
    }
    expect(platformFollowUpQuerySchema.safeParse({ filter: 'ilimitado' }).success).toBe(false);
    expect(platformFollowUpQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });
});

describe('platformUsersQuerySchema', () => {
  it('completa los valores por defecto', () => {
    expect(platformUsersQuerySchema.parse({})).toEqual({
      filter: 'all',
      segment: 'all',
      q: '',
      page: 1,
      pageSize: 20,
    });
  });

  it('acepta cada segmento y rechaza uno que no existe', () => {
    for (const segment of ['membership', 'staff', 'client', 'noProject', 'inactive']) {
      expect(platformUsersQuerySchema.parse({ segment }).segment).toBe(segment);
    }
    expect(platformUsersQuerySchema.safeParse({ segment: 'test' }).success).toBe(false);
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
