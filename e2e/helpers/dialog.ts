import { expect, test, type Page } from '@playwright/test';

/**
 * Adjunta al reporte una captura del AlertDialog abierto: es lo que mira
 * quien revisa una confirmación. Espera a que termine el fade de entrada —
 * si no, la captura sale a medio aparecer.
 */
/**
 * El AlertDialog abierto. Se busca por su `data-slot` y no sólo por el rol:
 * los avisos (toasts) de HeroUI también son `role="alertdialog"`, y un
 * `getByRole('alertdialog')` a secas choca con ellos.
 */
export function alertDialog(page: Page) {
  return page.locator('[role="alertdialog"][data-slot="alert-dialog-content"]');
}

export async function attachDialog(page: Page, name: string) {
  await expect(alertDialog(page)).toBeVisible();
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    ),
  );
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: 'image/png' });
}
