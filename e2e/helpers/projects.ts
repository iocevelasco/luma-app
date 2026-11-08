import { expect, type Page } from '@playwright/test';

export interface NewProject {
  name: string;
  location: string;
  start: string;
  end: string;
  currency: string;
}

/**
 * Crea una obra por el alta guiada: dos pasos (la obra; plazos y moneda) y la pantalla de
 * "¿por dónde seguimos?", de la que sale por "Ir al resumen de la obra". Termina en el
 * detalle de la obra, como terminaba el alta de una sola pantalla.
 *
 * Si ya está en el formulario (no hace falta el clic en "Nueva obra") sigue desde ahí.
 */
export async function createProjectViaForm(page: Page, project: NewProject) {
  const newProjectLink = page.getByRole('link', { name: /nueva obra/i });
  await expect(page.locator('#name').or(newProjectLink)).toBeVisible();
  if (await newProjectLink.isVisible()) await newProjectLink.click();

  // Paso 1: la obra (la descripción ya no se pide).
  await page.locator('#name').fill(project.name);
  await page.locator('#location').fill(project.location);
  await page.getByRole('button', { name: /siguiente/i }).click();

  // Paso 2: plazos y moneda (el inicio viene con hoy; se pisa con el de la prueba), y crear.
  await page.locator('#estimatedStartDate').fill(project.start);
  await page.locator('#estimatedEndDate').fill(project.end);
  await page.locator('#currency').click();
  await page.getByRole('option', { name: project.currency }).click();
  await page.getByRole('button', { name: /crear obra/i }).click();

  await expect(page.getByTestId('project-created')).toBeVisible();
  await page.getByTestId('next-step-detail').click();
}
