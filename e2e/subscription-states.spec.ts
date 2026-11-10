import { expect, test, type Page } from '@playwright/test';
import { requiresApi, requiresSubscriptionDemo } from './helpers/api';
import { authFile } from './helpers/users';

/**
 * Lo que ve el dueño de una Empresa en cada estado de la suscripción, con las
 * cuentas por estado de la suscripción (una por estado).
 *
 * Los estados son de verdad, de la base. Lo único simulado son los medios de
 * cobro: en CI y en local no hay cuentas cargadas, y un pago real necesita un
 * Binance Pay y un admin. Los textos se buscan con los que coinciden en todas
 * las variantes de castellano, porque la tanda corre sin fijar idioma.
 */
const SUBSCRIPTION = '/admin/settings/subscription';

async function withPaymentMethods(page: Page) {
  await page.route('**/api/subscription/me', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.subscription.paymentOptions = { card: false, bolivares: true, binance: true };
    await route.fulfill({ response, json: body });
  });
}

const planButton = (page: Page, plan: 'pro' | 'unlimited') => page.getByTestId(`plan-cta-${plan}`);
const checkoutBinance = (page: Page) => page.getByTestId('checkout-binance');

test.describe('suscripción por estado', () => {
  requiresApi();
  requiresSubscriptionDemo();

  test.describe('plan Gratis', () => {
    test.use({ storageState: authFile('demoGratis') });

    test('elige Ilimitado y paga con Binance, con comprobante obligatorio', async ({ page }) => {
      let quotedPlan: string | null = null;
      let posted: string | null = null;

      await withPaymentMethods(page);
      await page.route('**/api/subscription/quote/binance**', async (route) => {
        quotedPlan = new URL(route.request().url()).searchParams.get('plan');
        await route.fulfill({
          json: {
            success: true,
            data: {
              quote: {
                periodStart: '2026-11-09T00:00:00.000Z',
                periodEnd: '2026-12-09T00:00:00.000Z',
                lines: [],
                totalUsd: 149,
              },
              amountUsdt: 149,
              activatesNow: true,
              account: { payId: '123456789', name: 'Luma Pruebas' },
              plan: 'unlimited',
              planVersion: 1,
              receiptRequired: true,
            },
          },
        });
      });
      await page.route('**/api/subscription/payments/binance', async (route) => {
        posted = route.request().postDataBuffer()?.toString('latin1') ?? '';
        await route.fulfill({ status: 201, json: { success: true, data: { payment: {} } } });
      });

      await page.goto(SUBSCRIPTION);
      await expect(page.getByText('Gratis', { exact: true }).first()).toBeVisible();

      // Los tres escalones, en la tarjeta de Pro.
      await expect(page.getByText(/Obras 4 a 10/)).toBeVisible();
      await expect(page.getByText(/Obras 11 a 25/)).toBeVisible();
      await expect(page.getByText(/obra 26/)).toBeVisible();

      await planButton(page, 'unlimited').click();
      await checkoutBinance(page).click();
      await expect(page.getByText('149 USDT')).toBeVisible();
      expect(quotedPlan).toBe('unlimited');

      const submit = page.getByRole('button', { name: /enviar pago/i });

      await submit.click();
      await expect(page.locator('form').getByText(/comprobante del pago/i)).toBeVisible();
      expect(posted).toBeNull();

      await page.locator('#bn-receipt').setInputFiles({
        name: 'orden.png',
        mimeType: 'image/png',
        buffer: Buffer.from('png'),
      });
      await submit.click();

      await expect.poll(() => posted).toContain('name="plan"');
      expect(posted).toContain('unlimited');
      expect(posted).toContain('orden.png');
      await expect(page.getByText(/estamos confirmando tu pago/i).first()).toBeVisible();
    });
  });

  test.describe('plan Gratis por vencer, en el tope de obras', () => {
    test.use({ storageState: authFile('demoPorVencer') });

    test('la cuarta obra pide un plan pago, con el monto', async ({ page }) => {
      await page.goto('/admin');
      await page.getByRole('button', { name: /nueva obra/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText(/pas[aá] a pro/i).first()).toBeVisible();
      await expect(dialog.getByText(/47/)).toBeVisible();
      await expect(page).toHaveURL(/\/admin$/);
    });
  });

  test.describe('plan Pro pagado antes del catálogo', () => {
    test.use({ storageState: authFile('demoPro') });

    test('mantiene su precio y puede pasar a Ilimitado', async ({ page }) => {
      await withPaymentMethods(page);
      await page.goto(SUBSCRIPTION);

      await expect(page.getByText('Pro', { exact: true }).first()).toBeVisible();
      await expect(page.getByText(/1 obra extra a .*8/)).toBeVisible();
      await expect(planButton(page, 'unlimited')).toBeEnabled();
    });
  });

  test.describe('pago en revisión', () => {
    test.use({ storageState: authFile('demoEnRevision') });

    test('no deja mandar otro pago', async ({ page }) => {
      await withPaymentMethods(page);
      await page.goto(SUBSCRIPTION);

      await expect(page.getByText('Pago en revisión', { exact: true })).toBeVisible();
      await expect(planButton(page, 'pro')).toBeDisabled();
      await expect(planButton(page, 'unlimited')).toBeDisabled();
    });
  });

  test.describe('suscripción vencida', () => {
    test.use({ storageState: authFile('demoVencida') });

    test('puede pagar, y el motivo del rechazo está en el historial', async ({ page }) => {
      await withPaymentMethods(page);
      await page.goto(SUBSCRIPTION);

      await expect(page.getByText(/^(vencida|caducada)$/i).first()).toBeVisible();
      await planButton(page, 'pro').click();
      await expect(checkoutBinance(page)).toBeEnabled();
      await page.keyboard.press('Escape');

      await page.getByRole('tab').nth(1).click();
      await expect(page).toHaveURL(/tab=pagos/);
      await expect(page.getByText(/La referencia no aparece en el banco/)).toBeVisible();
    });

    test('las obras quedan en sólo lectura: no se pueden crear', async ({ page }) => {
      await page.goto('/admin');

      await expect(page.getByText('Baño Los Palos Grandes')).toBeVisible();
      await expect(page.getByRole('button', { name: /nueva obra/i })).toHaveCount(0);
    });
  });
});
