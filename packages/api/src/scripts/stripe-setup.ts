/**
 * Crea en Stripe el producto y los dos precios de Luma. Idempotente: busca
 * por `lookup_key` y sólo crea lo que falta. Correlo una vez en sandbox y una
 * vez en producción (con la clave de cada uno):
 *
 *   STRIPE_SECRET_KEY=sk_test_… pnpm --filter @luma/api stripe:setup
 *
 * Los montos salen de `PLAN` en `@luma/shared/billing`: la misma fuente que
 * usa la app para cotizar, así Stripe y la app no pueden discrepar.
 */
import { PLAN } from '@luma/shared';
import { STRIPE_CONFIG } from '../config/app.config.js';
import { stripeRequest } from '../services/stripe.client.js';

interface Price {
  id: string;
  lookup_key: string | null;
  unit_amount: number | null;
  product: string;
}

async function main() {
  if (!STRIPE_CONFIG.SECRET_KEY) {
    console.error('❌ Falta STRIPE_SECRET_KEY.');
    process.exit(1);
  }
  const mode = STRIPE_CONFIG.SECRET_KEY.startsWith('sk_live_') ? 'PRODUCCIÓN' : 'sandbox';
  console.log(`Stripe en modo ${mode}`);

  const wanted = [
    {
      lookup_key: STRIPE_CONFIG.BASE_PRICE_LOOKUP_KEY,
      nickname: `Plan Luma — ${PLAN.includedProjects} obras incluidas`,
      unit_amount: PLAN.basePriceUsd * 100,
    },
    {
      lookup_key: STRIPE_CONFIG.EXTRA_PRICE_LOOKUP_KEY,
      nickname: 'Obra adicional',
      unit_amount: PLAN.extraProjectPriceUsd * 100,
    },
  ];

  const { data: existing } = await stripeRequest<{ data: Price[] }>('GET', '/prices', {
    lookup_keys: wanted.map((w) => w.lookup_key),
    active: true,
  });

  let productId = existing[0]?.product;
  if (!productId) {
    const product = await stripeRequest<{ id: string }>(
      'POST',
      '/products',
      {
        name: 'Luma',
        description: 'Gestión de obras y remodelaciones',
        tax_code: STRIPE_CONFIG.PRODUCT_TAX_CODE,
      },
      { idempotencyKey: 'luma-product-v2' },
    );
    productId = product.id;
    console.log(`🆕 Producto ${productId}`);
  } else {
    // Un producto creado antes de que el código de impuesto fuera obligatorio.
    const product = await stripeRequest<{ tax_code: string | null }>('GET', `/products/${productId}`);
    if (product.tax_code !== STRIPE_CONFIG.PRODUCT_TAX_CODE) {
      await stripeRequest('POST', `/products/${productId}`, {
        tax_code: STRIPE_CONFIG.PRODUCT_TAX_CODE,
      });
      console.log(`🔧 Producto ${productId}: código de impuesto ${STRIPE_CONFIG.PRODUCT_TAX_CODE}`);
    } else {
      console.log(`✅ Producto ${productId} (impuesto ${product.tax_code})`);
    }
  }

  for (const price of wanted) {
    const found = existing.find((p) => p.lookup_key === price.lookup_key);
    if (found) {
      const ok = found.unit_amount === price.unit_amount;
      console.log(
        `${ok ? '✅' : '⚠️ '} ${price.lookup_key}: ${found.id} (${(found.unit_amount ?? 0) / 100} USD)` +
          (ok ? '' : ` — se esperaba ${price.unit_amount / 100}. Creá uno nuevo con transfer_lookup_key.`),
      );
      continue;
    }
    const created = await stripeRequest<Price>('POST', '/prices', {
      product: productId,
      currency: 'usd',
      unit_amount: price.unit_amount,
      recurring: { interval: 'month' },
      lookup_key: price.lookup_key,
      nickname: price.nickname,
    });
    console.log(`🆕 ${price.lookup_key}: ${created.id} (${price.unit_amount / 100} USD/mes)`);
  }

  console.log(`
Falta el webhook (una vez por entorno), en Stripe → Developers → Webhooks:
  URL:     https://<DOMINIO>/api/billing/stripe/webhook
  Eventos: checkout.session.completed, customer.subscription.created,
           customer.subscription.updated, customer.subscription.deleted,
           invoice.paid, invoice.payment_failed
y su "Signing secret" (whsec_…) va en STRIPE_WEBHOOK_SECRET.`);
}

main().catch((error) => {
  console.error('❌ stripe-setup:', error instanceof Error ? error.message : error);
  process.exit(1);
});
