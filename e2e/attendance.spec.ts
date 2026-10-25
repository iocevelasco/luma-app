import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { pickActivityResponsible, pickActivitySpecialty } from './helpers/activity';
import { addCrewMember } from './helpers/crew';
import { requiresApi } from './helpers/api';

/**
 * Asistencia del día contra la cuadrilla asignada: lo que la vista vieja no
 * podía responder. Se asigna gente a una actividad, se marca quién vino, y
 * del que faltó aparecen su teléfono para llamarlo y la opción de cubrirlo.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

requiresApi();

test.describe('asistencia contra la cuadrilla', () => {
  test('marca presentes, muestra al ausente con su teléfono y lo cubre', async ({ page }) => {
    const ownerEmail = `e2e-attendance-${RUN_ID}@luma.test`;
    const projectName = `Obra asistencia ${RUN_ID}`;
    const activityName = `Revoque grueso ${RUN_ID}`;
    const presentName = `Ana Vino ${RUN_ID}`;
    const absentName = `Beto Falto ${RUN_ID}`;
    const coverName = `Caro Cubre ${RUN_ID}`;

    await registerWith(page, `Ejecutante E2E ${RUN_ID}`, ownerEmail, PASSWORD);
    await loginWith(page, ownerEmail, PASSWORD);

    await page.getByRole('link', { name: /nueva obra/i }).click();
    await page.locator('#name').fill(projectName);
    await page.locator('#description').fill('Obra para probar la asistencia.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2027-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    // Una actividad vigente hoy, para que aparezca en la asistencia.
    await page.getByRole('link', { name: /^actividades$/i }).click();
    const today = new Date();
    await page.getByRole('button', { name: /nueva tarea/i }).click();
    await page.locator('#activity-name').fill(activityName);
    await pickActivitySpecialty(page);
    await page.locator('#activity-start').fill(toDayKey(today));
    await page
      .locator('#activity-end')
      .fill(toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5)));
    await pickActivityResponsible(page);
    await page.getByRole('button', { name: /crear tarea/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('link', { name: /^personal$/i }).click();
    await expect(page).toHaveURL(/\/personal$/);

    // --- Roster: uno de ellos con teléfono, para poder llamarlo ---
    await addCrewMember(page, { name: presentName });
    await addCrewMember(page, { name: absentName, phone: '11-5555-1234' });
    await addCrewMember(page, { name: coverName });

    // --- Se asignan dos a la actividad: la cuadrilla esperada ---
    // La asistencia vive en Personal.
    const card = page.locator('section', { hasText: activityName });

    for (const name of [presentName, absentName]) {
      await card.getByRole('button', { name: /asignar personal/i }).click();
      await card.getByRole('combobox').last().click();
      await page.getByRole('option', { name }).click();
      await expect(card.getByText(name)).toBeVisible();
    }

    // Nadie marcado todavía: faltan los dos.
    await expect(card.getByText(/faltan 2/i)).toBeVisible();

    // --- Viene uno solo ---
    await card.getByRole('button', { name: new RegExp(presentName, 'i') }).click();
    await expect(
      card.getByRole('button', { name: new RegExp(presentName, 'i') }),
    ).toHaveAttribute('aria-pressed', 'true');

    // --- Del ausente aparece el teléfono para llamarlo ---
    const callLink = card.getByRole('link', { name: /llamar/i });
    await expect(callLink).toBeVisible();
    await expect(callLink).toHaveAttribute('href', 'tel:11-5555-1234');

    // --- Y se lo puede cubrir con alguien libre del roster ---
    await card.getByRole('button', { name: /^cubrir$/i }).click();
    await card.getByRole('combobox').last().click();
    await page.getByRole('option', { name: coverName }).click();

    await expect(card.getByText(/cubriendo hoy/i)).toBeVisible();
    await expect(card.getByText(coverName)).toBeVisible();
  });
});
