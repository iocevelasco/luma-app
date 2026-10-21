import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { encodeParams, verifyStripeSignature } from '../../services/stripe.client.js';

describe('encodeParams', () => {
  it('codifica objetos y arrays anidados como los recibe Stripe', () => {
    expect(
      decodeURIComponent(
        encodeParams({
          mode: 'subscription',
          line_items: [
            { price: 'price_base', quantity: 1 },
            { price: 'price_extra', quantity: 2 },
          ],
          subscription_data: { metadata: { organizationId: 'org-1' }, trial_end: undefined },
        }),
      ),
    ).toBe(
      'mode=subscription&line_items[0][price]=price_base&line_items[0][quantity]=1&' +
        'line_items[1][price]=price_extra&line_items[1][quantity]=2&' +
        'subscription_data[metadata][organizationId]=org-1',
    );
  });

  it('escapa los valores', () => {
    expect(encodeParams({ success_url: 'https://x.test/a?b=1&c=2' })).toBe(
      'success_url=https%3A%2F%2Fx.test%2Fa%3Fb%3D1%26c%3D2',
    );
  });
});

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test_secret';
  const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
  const now = 1_760_000_000;
  const sign = (t: number, payload = body, key = secret) =>
    createHmac('sha256', key).update(`${t}.${payload}`).digest('hex');

  it('acepta una firma válida', () => {
    expect(() =>
      verifyStripeSignature(Buffer.from(body), `t=${now},v1=${sign(now)}`, secret, now),
    ).not.toThrow();
  });

  it('acepta si cualquiera de los v1 coincide (rotación del secreto)', () => {
    const header = `t=${now},v1=${sign(now, body, 'whsec_viejo')},v1=${sign(now)}`;
    expect(() => verifyStripeSignature(body, header, secret, now)).not.toThrow();
  });

  it('rechaza si el cuerpo cambió', () => {
    expect(() =>
      verifyStripeSignature(body.replace('evt_1', 'evt_2'), `t=${now},v1=${sign(now)}`, secret, now),
    ).toThrow(/firma/);
  });

  it('rechaza un evento de hace más de 5 minutos (reenvío de uno viejo)', () => {
    const old = now - 301;
    expect(() => verifyStripeSignature(body, `t=${old},v1=${sign(old)}`, secret, now)).toThrow(
      /viejo/,
    );
  });

  it('rechaza sin header o con uno mal formado', () => {
    expect(() => verifyStripeSignature(body, undefined, secret, now)).toThrow();
    expect(() => verifyStripeSignature(body, 'v1=abc', secret, now)).toThrow();
    expect(() => verifyStripeSignature(body, `t=${now},v1=zz`, secret, now)).toThrow();
  });
});
