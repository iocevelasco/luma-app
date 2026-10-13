import { expect, type Page } from '@playwright/test';

/**
 * Suma personal a la obra abierta desde el drawer "Agregar personal" de la
 * pantalla Personal. Crea en la libreta de la Empresa y lo deja asignado.
 *
 * Los specs que necesitan gente para trabajar —asistencia, metas— no
 * deberían saber cómo es el formulario.
 */
export async function addCrewMember(
  page: Page,
  member: {
    name: string;
    phone?: string;
    kind?: RegExp;
    specialty?: RegExp;
    isLead?: boolean;
  },
) {
  await page.getByRole('button', { name: /^agregar personal$/i }).click();
  const drawer = page.getByRole('dialog');

  await drawer.locator('#add-crew-name').fill(member.name);
  if (member.kind) {
    await drawer.locator('#add-crew-kind').click();
    await page.getByRole('option', { name: member.kind }).click();
  }
  if (member.specialty) {
    await drawer.locator('#add-crew-specialty').click();
    await page.getByRole('option', { name: member.specialty }).click();
  }
  if (member.phone) await drawer.locator('#add-crew-phone').fill(member.phone);
  if (member.isLead) await drawer.getByText(/es el encargado de su especialidad/i).click();

  await drawer.getByRole('button', { name: /crear y sumar a la obra/i }).click();
  await expect(drawer).toBeHidden();
}
