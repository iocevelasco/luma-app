import { expect, test, type Page } from '@playwright/test';
import { requiresApi } from './helpers/api';
import { appUrl, loginAs } from './helpers/auth';
import { authFile, E2E_PROJECT_NAME, e2eUser, type E2EProjectRoleKey } from './helpers/users';

/**
 * Qué ve cada tipo de cuenta, con las cuentas fijas que siembra el globalSetup
 * (`e2e/fixtures/users.json`). Cada rol entra con su sesión guardada a la obra
 * compartida y se mira el riel de secciones: es lo primero que una persona ve
 * de lo que puede hacer, y lo que primero se rompe si la UI deja de leer
 * `project.capabilities`.
 *
 * La matriz está escrita a mano y no derivada de la grilla de `@luma/shared`
 * a propósito: derivarla probaría que la grilla coincide consigo misma.
 */

requiresApi();

const SECTIONS = [
  'detail',
  'activities',
  'materials',
  'labor',
  'milestones',
  'documents',
  'providers',
  'payments',
  'expenses',
  'budget',
  'team',
] as const;

type Section = (typeof SECTIONS)[number];

const VISIBLE_SECTIONS: Record<E2EProjectRoleKey, readonly Section[]> = {
  gerente: SECTIONS,
  // Reporta, no maneja plata ni accesos.
  supervisor: ['detail', 'activities', 'materials', 'labor', 'milestones', 'documents', 'providers'],
  // Sólo plata: nada de obra.
  contador: ['detail', 'payments', 'expenses'],
  // Cobros sí, gastos nunca. Proveedores depende del flag de la obra, que el
  // seed deja apagado.
  cliente: ['detail', 'activities', 'milestones', 'documents', 'payments'],
};

for (const [role, visible] of Object.entries(VISIBLE_SECTIONS) as [
  E2EProjectRoleKey,
  readonly Section[],
][]) {
  test.describe(`rol de obra: ${role}`, () => {
    test.use({ storageState: authFile(role) });

    test('ve en la obra sólo las secciones de su rol', async ({ page }) => {
      await page.goto(appUrl('/admin'));
      await page.getByRole('link', { name: E2E_PROJECT_NAME }).first().click();
      // La card abre en la sección de trabajo de cada rol, no siempre en el
      // detalle: alcanza con estar dentro de la obra.
      await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+/);

      // Primero las que tiene: esperan a que lleguen las capacidades. Recién
      // ahí tiene sentido afirmar que las otras no están.
      for (const section of visible) {
        await expect(page.getByTestId(`project-nav-${section}`)).toBeVisible();
      }
      for (const section of SECTIONS.filter((s) => !visible.includes(s))) {
        await expect(page.getByTestId(`project-nav-${section}`)).toHaveCount(0);
      }
    });
  });
}

/**
 * El home muestra el botón de "Nueva obra" recién cuando llegó el listado
 * (mientras carga hay un spinner): esperarlo es lo que le da sentido a
 * afirmar después que la obra NO está.
 */
async function openProjectList(page: Page) {
  await page.goto(appUrl('/admin'));
  await expect(page.getByRole('link', { name: /nueva obra/i })).toBeVisible();
}

test.describe('cuentas sin acceso a la obra', () => {
  test.describe('usuario sin obras', () => {
    test.use({ storageState: authFile('user') });

    test('ve el estado vacío y no la obra de otro', async ({ page }) => {
      await openProjectList(page);
      await expect(page.getByText(/todavía no tenés obras/i)).toBeVisible();
      await expect(page.getByRole('link', { name: E2E_PROJECT_NAME })).toHaveCount(0);
    });
  });

  test.describe('admin de plataforma', () => {
    test.use({ storageState: authFile('admin') });

    // El rol de plataforma no gatea el producto: ser admin no abre obras ajenas.
    test('no ve la obra si no es parte de ella', async ({ page }) => {
      await openProjectList(page);
      await expect(page.getByRole('link', { name: E2E_PROJECT_NAME })).toHaveCount(0);
    });
  });
});

test.describe('cuenta dada de baja', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('el login la rechaza y explica por qué', async ({ page }) => {
    const { email, password } = e2eUser('inactive');
    await page.goto(appUrl('/login'));
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /entrar/i }).click();

    await expect(page.getByText(/la cuenta está deshabilitada/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('login con una cuenta fija', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('el supervisor entra con sus credenciales y llega al panel', async ({ page }) => {
    await loginAs(page, 'supervisor');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('link', { name: E2E_PROJECT_NAME }).first()).toBeVisible();
  });
});
