import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';

/**
 * Estos tests registran sus propias cuentas: `storageState` se limpia por
 * archivo. Sin eso, la sesión de admin que siembra el globalSetup mandaría
 * `/register` directo a `/admin` (PublicOnlyLayout) antes de que el test
 * pudiera hacer nada.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_NAME = `Ejecutante E2E ${RUN_ID}`;
const OWNER_EMAIL = `e2e-owner-${RUN_ID}@luma.test`;
const CLIENT_NAME = `Cliente E2E ${RUN_ID}`;
const CLIENT_EMAIL = `e2e-client-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Baño 2do piso ${RUN_ID}`;
const NEW_ORG_NAME = `Obras ${RUN_ID}`;

test.describe('empresa, obra e invitación del cliente', () => {
  test('un ejecutante se registra solo, crea una obra e invita al cliente que la paga', async ({
    page,
    browser,
  }) => {
    // El cliente ya tiene que existir en Luma para probar el camino de
    // "invitar a un email que ya tiene cuenta" — el camino de activación por
    // correo real no se cubre acá (ver plan: no hay bandeja de entrada en CI).
    const clientContext = await browser.newContext();
    const clientPage = await clientContext.newPage();
    await registerWith(clientPage, CLIENT_NAME, CLIENT_EMAIL, PASSWORD);

    // Autoservicio puro: nadie invita al ejecutante, se da de alta solo y ya
    // puede gestionar obras.
    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    // Empresa personal auto-creada, nombrada como la persona — y editable.
    await expect(page.getByRole('button', { name: OWNER_NAME })).toBeVisible();
    await page.getByRole('button', { name: OWNER_NAME }).click();
    await page.getByRole('textbox').fill(NEW_ORG_NAME);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: NEW_ORG_NAME })).toBeVisible();

    // Primera obra, desde el estado vacío.
    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/nuevo/);

    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Remodelación completa del baño principal.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-10-15');

    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.locator('#budgetType').click();
    await page.getByRole('option', { name: /cerrado/i }).click();

    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
    await expect(page.getByText(PROJECT_NAME)).toBeVisible();

    // Invitar a quien paga la obra.
    await page.getByRole('button', { name: /invitar cliente/i }).click();
    await page.locator('#client-email').fill(CLIENT_EMAIL);
    await page.getByRole('dialog').getByRole('button', { name: /invitar/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(CLIENT_EMAIL)).toBeVisible();

    // El cliente entra con su propia cuenta y ve la obra, sin poder gestionarla.
    await loginWith(clientPage, CLIENT_EMAIL, PASSWORD);
    await expect(clientPage).toHaveURL(/\/admin$/);
    await clientPage.getByRole('link', { name: PROJECT_NAME }).click();
    await expect(clientPage.getByText(PROJECT_NAME)).toBeVisible();
    await expect(clientPage.getByRole('button', { name: /invitar cliente/i })).toHaveCount(0);

    await clientContext.close();
  });
});
