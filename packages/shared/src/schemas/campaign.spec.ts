import { describe, expect, it } from 'vitest';
import { campaignInputSchema } from './campaign.js';

describe('campaignInputSchema', () => {
  it('recorta los espacios', () => {
    expect(campaignInputSchema.parse({ title: '  Hola ', body: ' Novedades ' })).toEqual({
      title: 'Hola',
      body: 'Novedades',
    });
  });

  it('exige título y contenido', () => {
    expect(campaignInputSchema.safeParse({ title: ' ', body: 'x' }).success).toBe(false);
    expect(campaignInputSchema.safeParse({ title: 'x', body: '' }).success).toBe(false);
  });
});
