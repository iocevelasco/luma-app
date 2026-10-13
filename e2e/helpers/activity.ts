import type { Page } from '@playwright/test';

/**
 * Elige la especialidad en el formulario de "Nueva actividad".
 *
 * Es obligatoria desde que reemplazó al campo de área: los specs que crean
 * una actividad sólo para tener algo con qué trabajar no deberían saber cómo
 * es el selector. Por defecto, Albañilería (el rubro más genérico de obra).
 */
export async function pickActivitySpecialty(page: Page, name: RegExp = /albañilería/i) {
  await page.locator('#activity-specialty').click();
  await page.getByRole('option', { name }).click();
}

/**
 * Elige el responsable en el formulario de "Nueva actividad".
 *
 * Es un selector entre los empleados de la Empresa y ya no un campo de texto:
 * un nombre escrito a mano se desalinea solo. Los specs que crean una actividad
 * sólo para tener algo con qué trabajar no deberían saber cómo es. Por defecto
 * elige a quien está logueado ("… (vos)"), que siempre figura en la lista aun
 * sin empleados cargados.
 */
export async function pickActivityResponsible(page: Page, name: RegExp = /\(vos\)/i) {
  await page.locator('#activity-responsible').click();
  await page.getByRole('option', { name }).click();
}

