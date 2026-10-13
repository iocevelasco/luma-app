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
 * Ya no es un nombre tipeado: es un selector con quien está logueado, el
 * personal de obra y el administrativo (ver `ResponsibleField`). Por defecto
 * elige a quien está logueado, que es la única opción que existe siempre —
 * una obra recién creada todavía no tiene personal.
 */
export async function pickActivityResponsible(page: Page, name: RegExp = /\(vos\)$/i) {
  await page.locator('#activity-responsible').click();
  await page.getByRole('option', { name }).click();
}
