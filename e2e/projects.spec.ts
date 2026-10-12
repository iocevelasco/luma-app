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
    // Vive en su propia pantalla, no al final de la home: ahí quedaba debajo
    // del listado de obras y con unas cuantas había que scrollear.
    await page.getByTestId('nav-company').click();
    await expect(page).toHaveURL(/\/admin\/empresa$/);
    await expect(page.locator('#org-name')).toHaveValue(OWNER_NAME);
    await page.locator('#org-name').fill(NEW_ORG_NAME);
    await page.getByRole('button', { name: /^guardar$/i }).click();
    await expect(page.getByText(/datos de la empresa guardados/i)).toBeVisible();
    await expect(page.locator('#org-name')).toHaveValue(NEW_ORG_NAME);

    // Primera obra, desde el estado vacío de la home.
    await page.getByTestId('nav-home').click();
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

    // Dar acceso vive en su propia pantalla: es una tarea con su momento, no
    // algo con lo que uno se tropieza mirando cómo viene la obra.
    await page.goto(`${page.url()}/equipo`);
    await page.getByRole('button', { name: /dar acceso/i }).first().click();
    await page.locator('#member-email').fill(CLIENT_EMAIL);
    // El rol es explícito: el mismo diálogo invita supervisores y contadores,
    // así que no hay default silencioso.
    await page.getByRole('dialog').getByRole('button', { name: /^cliente$/i }).click();
    await page.getByRole('dialog').getByRole('button', { name: /^dar acceso$/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByText(CLIENT_EMAIL)).toBeVisible();

    // El cliente entra con su propia cuenta y ve la obra, sin poder gestionarla.
    await loginWith(clientPage, CLIENT_EMAIL, PASSWORD);
    await expect(clientPage).toHaveURL(/\/admin$/);
    await clientPage.getByRole('link', { name: PROJECT_NAME }).click();
    // `.first()`: el nombre de la obra aparece dos veces una vez adentro —en
    // el breadcrumb del header y en el contenido—, y sin acotar el modo
    // estricto de Playwright lo toma como ambigüedad.
    await expect(clientPage.getByText(PROJECT_NAME).first()).toBeVisible();
    // Ni la pestaña de equipo ni la de gastos existen para el cliente.
    await expect(clientPage.getByRole('link', { name: /^equipo$/i })).toHaveCount(0);
    await expect(clientPage.getByRole('link', { name: /^gastos$/i })).toHaveCount(0);
    // Pero sí ve su cronograma de pagos: es su fila de la matriz de roles.
    await expect(clientPage.getByRole('link', { name: /^pagos$/i })).toBeVisible();

    await clientContext.close();
  });
});
