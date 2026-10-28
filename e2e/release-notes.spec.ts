import { expect, test } from '@playwright/test';
import { requiresApi } from './helpers/api';
import { authFile } from './helpers/users';

/**
 * Novedades: lo nuevo y lo arreglado, en la campana.
 *
 * Lo que este spec fija:
 *
 * 1. Quien no las vio tiene un punto (nunca un número: el número es de los
 *    avisos de obra) y la campana lo dice en su nombre accesible.
 * 2. Verlas las marca como vistas: el punto se apaga y no vuelve al recargar.
 *
 * Que la marca sobreviva a un deploy (`version-manager` limpia el storage) y
 * que el storage bloqueado no tire lo cubren los unit de `release-notes.spec.ts`.
 */
test.use({ storageState: authFile('gerente') });

requiresApi();

test.describe('Novedades', () => {
  test('se leen en la campana y el punto se apaga al verlas, también después de recargar', async ({
    page,
  }) => {
    await page.goto('/admin');
    const bell = () => page.getByRole('button', { name: /notificaciones/i });

    // Sin ver: la campana lo dice, haya o no avisos sin leer.
    await expect(bell()).toHaveAccessibleName(/hay novedades/i);

    await bell().click();
    await page.getByRole('tab', { name: /novedades/i }).click();
    const notes = page.getByTestId('release-notes');
    await expect(notes.getByRole('heading', { name: /novedades en luma/i })).toBeVisible();
    await expect(notes).toContainText('Nueva especialidad');
    await expect(notes).toContainText('Decisión tomada');
    await expect(notes.getByText(/cambios del 28 de octubre de 2026/i)).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(bell()).not.toHaveAccessibleName(/hay novedades/i);
    await expect(page.getByTestId('release-notes-dot')).toHaveCount(0);

    // Recordado: no vuelve a avisar.
    await page.reload();
    await expect(bell()).toBeVisible();
    await expect(bell()).not.toHaveAccessibleName(/hay novedades/i);
  });
});
