import { expect, test, type Page } from '@playwright/test';

/**
 * Adjunta al reporte una captura del AlertDialog abierto: es lo que mira
 * quien revisa una confirmación. Espera a que termine el fade de entrada —
 * si no, la captura sale a medio aparecer.
 */
export async function attachDialog(page: Page, name: string) {
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        // Una animación cancelada (el diálogo anterior se desmontó a mitad de su salida) rechaza
        // `finished`: para esperar da lo mismo que haya terminado, así que no es un error.
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
  const path = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path });
  await test.info().attach(name, { path, contentType: 'image/png' });
}
