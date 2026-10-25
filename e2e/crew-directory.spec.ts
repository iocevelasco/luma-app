import { expect, test, type Page } from '@playwright/test';
import { appUrl, loginWith, registerWith } from './helpers/auth';
import { addCrewMember } from './helpers/crew';
import { requiresApi } from './helpers/api';

/**
 * Un obrero existe una sola vez en la Empresa. Se carga en la obra A; en la
 * obra B el drawer lo ofrece mientras se tipea —sin tildes ni mayúsculas— y
 * se lo suma sin crear otro. Si igual se intenta crearlo de nuevo, el
 * servidor lo frena y el banner ofrece la salida.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';

async function createProject(page: Page, name: string) {
  await page.goto(appUrl('/admin/proyectos/nuevo'));
  await page.locator('#name').fill(name);
  await page.locator('#description').fill('Obra para probar el directorio de empleados.');
  await page.locator('#location').fill('CABA');
  await page.locator('#estimatedStartDate').fill('2026-09-01');
  await page.locator('#estimatedEndDate').fill('2026-12-15');
  await page.locator('#currency').click();
  await page.getByRole('option', { name: 'ARS' }).click();
  await page.getByRole('button', { name: /crear obra/i }).click();
  await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
  await page.getByRole('link', { name: /^personal$/i }).click();
  await expect(page).toHaveURL(/\/personal$/);
}

requiresApi();

test.describe('empleados sin duplicar entre obras', () => {
  test('el obrero de la obra A se suma a la obra B sin recrearlo', async ({ page }) => {
    const ownerEmail = `e2e-crew-dir-${RUN_ID}@luma.test`;
    const workerName = `Rosa Ñáñez ${RUN_ID}`;

    await registerWith(page, `Ejecutante E2E ${RUN_ID}`, ownerEmail, PASSWORD);
    await loginWith(page, ownerEmail, PASSWORD);

    // --- Obra A: se carga a la persona ---
    await createProject(page, `Obra A ${RUN_ID}`);
    await addCrewMember(page, { name: workerName, phone: '11 4444 5555' });

    // --- Obra B: el drawer la ofrece mientras se tipea, sin tildes ---
    await createProject(page, `Obra B ${RUN_ID}`);
    await page.getByRole('button', { name: /^agregar personal$/i }).click();
    const drawer = page.getByRole('dialog');
    await drawer.locator('#add-crew-name').fill(`rosa nanez ${RUN_ID}`);

    const suggestion = drawer.getByRole('listitem').filter({ hasText: workerName });
    await expect(suggestion).toBeVisible();
    // Ficha completa también desde la búsqueda: el teléfono distingue homónimos.
    await expect(suggestion).toContainText('11 4444 5555');
    await suggestion.getByRole('button', { name: /sumar a esta obra/i }).click();
    await expect(drawer).toBeHidden();

    await page.getByRole('button', { name: /^personal fijo$/i }).click();
    const roster = page.getByRole('dialog');
    await expect(roster.getByText(workerName)).toBeVisible();
    await roster.getByRole('button', { name: /close/i }).click();

    // --- Crearla otra vez, ignorando la sugerencia: el servidor la frena ---
    await page.getByRole('button', { name: /^agregar personal$/i }).click();
    await drawer.locator('#add-crew-name').fill(`Otro nombre ${RUN_ID}`);
    await drawer.locator('#add-crew-phone').fill('+11-4444-5555');
    await drawer.getByRole('button', { name: /crear y sumar a la obra/i }).click();
    await expect(drawer.getByRole('alert')).toContainText(/ya está en esta obra/i);
    await drawer.getByRole('button', { name: /cancelar/i }).click();

    // --- En la Empresa sigue habiendo una sola ---
    await page.goto(appUrl('/admin/empleados'));
    await expect(page.getByText(workerName)).toHaveCount(1);
  });

  test('el banner del duplicado ofrece la salida: sumar, o "es otra persona"', async ({
    page,
  }) => {
    const ownerEmail = `e2e-crew-dup-${RUN_ID}@luma.test`;
    const workerName = `Luis Gómez ${RUN_ID}`;
    const phone = '11 7777 8888';

    await registerWith(page, `Ejecutante dup ${RUN_ID}`, ownerEmail, PASSWORD);
    await loginWith(page, ownerEmail, PASSWORD);

    await createProject(page, `Obra dup A ${RUN_ID}`);
    await addCrewMember(page, { name: workerName, phone });

    await createProject(page, `Obra dup B ${RUN_ID}`);
    const drawer = page.getByRole('dialog');
    const banner = drawer.getByRole('alert');

    // --- Mismo nombre, otra persona: se puede insistir ---
    await page.getByRole('button', { name: /^agregar personal$/i }).click();
    await drawer.locator('#add-crew-name').fill(`luis gomez ${RUN_ID}`);
    await drawer.getByRole('button', { name: /crear y sumar a la obra/i }).click();
    await expect(banner).toContainText(/ya hay alguien llamado/i);
    await expect(banner.getByRole('button', { name: /sumar a esta obra/i })).toBeVisible();
    await banner.getByRole('button', { name: /es otra persona/i }).click();
    await expect(drawer).toBeHidden();

    // --- Mismo teléfono: es la misma persona, sin "es otra" ---
    await page.getByRole('button', { name: /^agregar personal$/i }).click();
    await drawer.locator('#add-crew-name').fill(`Lucho ${RUN_ID}`);
    await drawer.locator('#add-crew-phone').fill('+11-7777-8888');
    await drawer.getByRole('button', { name: /crear y sumar a la obra/i }).click();
    await expect(banner).toContainText(new RegExp(`ese teléfono ya es de ${workerName}`, 'i'));
    await expect(banner.getByRole('button', { name: /es otra persona/i })).toHaveCount(0);
    await banner.getByRole('button', { name: /sumar a esta obra/i }).click();
    await expect(drawer).toBeHidden();

    // La obra B tiene a los dos Luis —el de la obra A, sumado; y el homónimo—
    // y ningún "Lucho".
    await page.getByRole('button', { name: /^personal fijo$/i }).click();
    const roster = page.getByRole('dialog');
    await expect(roster.getByText(workerName)).toBeVisible();
    await expect(roster.getByText(`luis gomez ${RUN_ID}`)).toBeVisible();
    await expect(roster.getByText(`Lucho ${RUN_ID}`)).toHaveCount(0);
    await roster.getByRole('button', { name: /close/i }).click();

    // --- Desde Empleados rige el mismo guardia ---
    await page.goto(appUrl('/admin/empleados'));
    await page.getByRole('button', { name: /sumar personal de obra/i }).click();
    await drawer.locator('#directory-crew-name').fill(workerName);
    await drawer.getByRole('button', { name: /crear empleado/i }).click();
    await expect(banner).toContainText(/ya hay alguien llamado/i);
    // Desde la Empresa no hay obra a la cual sumarlo.
    await expect(banner.getByRole('button', { name: /sumar a esta obra/i })).toHaveCount(0);
    await banner.getByRole('button', { name: /es otra persona/i }).click();
    await expect(drawer).toBeHidden();
  });
});
