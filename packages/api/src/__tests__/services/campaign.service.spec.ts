import { describe, expect, it, vi } from 'vitest';
vi.mock('../../config/app.config.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../config/app.config.js')>();
  return { ...original, JWT_CONFIG: { ...original.JWT_CONFIG, SECRET: 'test-secret' } };
});

import { campaignBodyHtml } from '../../services/email.service.js';
import { isValidUnsubscribe, unsubscribeUrl } from '../../utils/unsubscribe.js';

describe('campaignBodyHtml', () => {
  it('arma un párrafo por línea en blanco y escapa el HTML', () => {
    expect(campaignBodyHtml('Hola <b>\n\nChau\nvuelta')).toBe(
      '<p>Hola &lt;b&gt;</p><p>Chau<br>vuelta</p>',
    );
  });
});

describe('enlace de baja', () => {
  it('sólo vale con la firma de esa cuenta', () => {
    const url = new URL(unsubscribeUrl('abc123'));
    const sig = url.searchParams.get('s')!;
    expect(isValidUnsubscribe('abc123', sig)).toBe(true);
    expect(isValidUnsubscribe('otra', sig)).toBe(false);
    expect(isValidUnsubscribe('abc123', 'x')).toBe(false);
  });
});
