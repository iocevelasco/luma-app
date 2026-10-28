import { expect, test, type Page } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { requiresApi } from './helpers/api';
import { authFile, E2E_PROJECT_NAME } from './helpers/users';

/**
 * Varios gerentes por obra, hasta cinco contando a quien la creó.
 *
 * Lo que este spec fija, que es lo que más fácil se afloja:
 *
 * 1. El tope se ve **antes** de chocar con él: "1 de 5", y al llegar a cinco la
 *    opción Gerente se apaga y dice por qué.
 * 2. Otro gerente hace casi todo, pero no elimina la obra ni toca a los demás
 *    gerentes: eso es de quien la creó.
 *
 * El tope en el servidor (la carrera entre dos invitaciones, subir a alguien a
 * gerente sin lugar) lo cubren los unit de `project.controller.spec.ts`.
 */
const RUN_ID = Date.now();
const PASSWORD = 'E2eGerentes1234!';

requiresApi();

/** Da acceso como gerente desde Equipo. Sin mail configurado el alta muestra el enlace a mano. */
async function addManager(page: Page, email: string) {
  await page.getByRole('button', { name: /dar acceso/i }).first().click();
  await page.locator('#member-email').fill(email);
  await page.getByRole('dialog').getByRole('button', { name: /^gerente de obra$/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^dar acceso$/i }).click();
  await expect(page.getByText(email)).toBeVisible();
  await page
    .getByRole('button', { name: /^listo$/i })
    .click({ timeout: 2_000 })
    .catch(() => {});
}

/** Entra al detalle de la obra compartida del fixture desde el listado y devuelve su URL. */
async function openSharedProject(page: Page): Promise<string> {
  await page.goto('/admin');
  await page.getByRole('link', { name: E2E_PROJECT_NAME }).first().click();
  // El listado lleva a Actividades: el detalle es la misma obra, un nivel arriba.
  await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+/);
  const projectUrl = page.url().replace(/(\/admin\/proyectos\/[a-f0-9]+).*$/, '$1');
  await page.goto(projectUrl);
  return projectUrl;
}

test.describe('Gerentes de la obra', () => {
  test.describe('quien creó la obra', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('suma gerentes hasta el máximo: el contador sube y la opción se apaga al llegar a cinco', async ({
      page,
    }) => {
      test.setTimeout(90_000);
      const owner = `e2e-mgr-owner-${RUN_ID}@luma.test`;
      await registerWith(page, `Dueño gerentes ${RUN_ID}`, owner, PASSWORD);
      await loginWith(page, owner, PASSWORD);

      await page.getByRole('link', { name: /nueva obra/i }).click();
      await page.locator('#name').fill(`Obra gerentes ${RUN_ID}`);
      await page.locator('#description').fill('Obra para probar el tope de gerentes.');
      await page.locator('#location').fill('CABA');
      await page.locator('#estimatedStartDate').fill('2026-09-01');
      await page.locator('#estimatedEndDate').fill('2026-12-15');
      await page.locator('#currency').click();
      await page.getByRole('option', { name: 'ARS' }).click();
      await page.getByRole('button', { name: /crear obra/i }).click();
      await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
      const teamUrl = `${page.url()}/equipo`;

      await page.goto(teamUrl);
      const meter = page.getByTestId('manager-slots');
      await expect(meter).toHaveText(/1 de 5/);
      await expect(page.getByText(/creó la obra/i)).toBeVisible();

      for (const index of [1, 2, 3, 4]) {
        await addManager(page, `e2e-mgr-${index}-${RUN_ID}@luma.test`);
        await expect(meter).toHaveText(new RegExp(`${index + 1} de 5`));
      }

      // Cinco de cinco: se dice con todas las palabras, y las invitaciones sin
      // activar figuran como lo que son — ocupan lugar igual.
      await expect(meter).toHaveText(/5 de 5 · máximo/);
      await expect(page.getByText(/invitación pendiente/i)).toHaveCount(4);

      await page.getByRole('button', { name: /dar acceso/i }).first().click();
      const manager = page.getByRole('dialog').getByRole('button', { name: /^gerente de obra$/i });
      await expect(manager).toBeDisabled();
      await expect(page.getByTestId('manager-slots-hint')).toContainText(/5 gerentes/);
      // Los demás roles siguen disponibles: el tope es sólo de gerentes.
      await expect(
        page.getByRole('dialog').getByRole('button', { name: /^supervisor de obra$/i }),
      ).toBeEnabled();
    });
  });

  test.describe('otro gerente', () => {
    test.use({ storageState: authFile('cogerente') });

    test('ve la obra y suma gente, pero no la elimina ni toca a los demás gerentes', async ({
      page,
    }) => {
      const projectUrl = await openSharedProject(page);

      // Eliminar la obra es de quien la creó.
      await expect(page.getByRole('heading', { name: E2E_PROJECT_NAME }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /eliminar obra/i })).toHaveCount(0);

      await page.goto(`${projectUrl}/equipo`);
      // Sí suma gente: la acción principal está.
      await expect(page.getByRole('button', { name: /dar acceso/i }).first()).toBeVisible();

      const managers = page.locator('section').filter({
        has: page.getByRole('heading', { name: /^gerentes$/i }),
      });
      await expect(managers.getByTestId('manager-slots')).toHaveText(/2 de 5/);
      // Quien la creó lo dice en su fila, y ninguno de los dos gerentes se toca.
      await expect(managers.getByText(/creó la obra/i)).toHaveCount(1);
      await expect(managers.getByRole('combobox')).toHaveCount(0);
      await expect(managers.getByRole('button', { name: /quitar de la obra/i })).toHaveCount(0);

      // Al resto del equipo sí le cambia el rol.
      const supervisors = page.locator('section').filter({
        has: page.getByRole('heading', { name: /^supervisores$/i }),
      });
      await expect(supervisors.getByRole('combobox')).toHaveCount(1);
    });
  });

  test.describe('quien creó la obra compartida', () => {
    test.use({ storageState: authFile('gerente') });

    test('sí puede eliminarla y sacar a otro gerente', async ({ page }) => {
      const projectUrl = await openSharedProject(page);

      // Control positivo: sin esto, el "no ve Eliminar" de arriba pasaría aunque
      // el botón hubiera cambiado de nombre.
      await expect(page.getByRole('button', { name: /eliminar obra/i })).toBeVisible();

      await page.goto(`${projectUrl}/equipo`);
      const managers = page.locator('section').filter({
        has: page.getByRole('heading', { name: /^gerentes$/i }),
      });
      // Su propia fila no se toca (no tiene membresía); la del otro gerente sí.
      await expect(managers.getByRole('combobox')).toHaveCount(1);
      await expect(managers.getByRole('button', { name: /quitar de la obra/i })).toHaveCount(1);
    });
  });
});
