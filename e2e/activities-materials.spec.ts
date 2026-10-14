import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { pickActivityResponsible, pickActivitySpecialty } from './helpers/activity';

/**
 * Flujo principal de RF-01 (planificación semanal) y RF-02 (materiales):
 * registra su propia cuenta, crea una obra, agrega una actividad de esta
 * semana, navega a la siguiente y vuelve, agrega un material asociado y
 * confirma el cambio de estado.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_NAME = `Ejecutante E2E ${RUN_ID}`;
const OWNER_EMAIL = `e2e-activities-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra actividades ${RUN_ID}`;
const ACTIVITY_NAME = `Contrapiso ${RUN_ID}`;
const MATERIAL_NAME = `Cemento ${RUN_ID}`;

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

test.describe('planificación semanal y materiales', () => {
  test('crea una obra, planifica una actividad y gestiona sus materiales', async ({ page }) => {
    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para probar actividades y materiales.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    await page.getByRole('link', { name: /^cronograma$/i }).click();
    await expect(page).toHaveURL(/\/actividades$/);

    const today = new Date();
    const start = toDayKey(today);
    const end = toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));

    await page.getByRole('button', { name: /nueva tarea/i }).click();
    await page.locator('#activity-name').fill(ACTIVITY_NAME);
    await pickActivitySpecialty(page);
    await page.locator('#activity-start').fill(start);
    await page.locator('#activity-end').fill(end);
    await pickActivityResponsible(page);
    await page.getByRole('button', { name: /crear tarea/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Aparece como fila del gantt del rango actual (este mes).
    const activityRow = page.getByRole('gridcell', { name: ACTIVITY_NAME });
    await expect(activityRow).toBeVisible();

    // Abre el detalle en el modal de pantalla completa y vuelve sin cambiar la URL.
    await activityRow.click();
    const detailDialog = page.getByRole('dialog');
    await expect(detailDialog.getByText(ACTIVITY_NAME)).toBeVisible();
    await expect(page).toHaveURL(/\/actividades$/);

    // Evidencia fotográfica (RF-04): sin storage configurado en este entorno,
    // igual tiene que renderizar el vacío en vez de romper la pantalla.
    await expect(detailDialog.getByText(/todavía no se subieron fotos/i)).toBeVisible();
    await expect(detailDialog.getByRole('button', { name: /agregar foto/i })).toBeVisible();

    await detailDialog.getByRole('button', { name: /atrás/i }).click();
    await expect(detailDialog).toBeHidden();

    // Agrega un material asociado a esa actividad.
    await page.goto(page.url().replace(/\/actividades$/, ''));
    await page.getByRole('link', { name: /^compras$/i }).click();
    await expect(page).toHaveURL(/\/materiales$/);

    // El alta vive en el drawer lateral, no en la cabecera de la página.
    await page.getByRole('button', { name: /agregar material/i }).click();
    await page.locator('#material-name').fill(MATERIAL_NAME);
    await page.locator('#material-quantity').fill('10');
    await page.locator('#material-unit').click();
    await page.getByRole('option', { name: /bolsa/i }).click();
    await page.locator('#material-activity').click();
    await page.getByRole('option', { name: ACTIVITY_NAME }).click();
    await page.getByRole('button', { name: /^agregar$/i }).click();

    await expect(page.getByText(MATERIAL_NAME)).toBeVisible();

    // Recién cargado, está "por comprar" —la pestaña que abre por defecto—:
    // avanza al paso siguiente y confirma.
    const toBuy = page.getByRole('tabpanel', { name: /por comprar/i });
    await expect(toBuy.getByText(MATERIAL_NAME)).toBeVisible();
    await toBuy.getByRole('button', { name: /marcar solicitado/i }).click();
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();

    // Sigue por comprar (solicitado todavía no es comprado); al marcarlo
    // comprado pasa a la otra pestaña.
    await toBuy.getByRole('button', { name: /marcar comprado/i }).click();
    await page.getByRole('button', { name: /continuar/i }).click();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    // Antes de cambiar de pestaña: la inactiva se desmonta, y ahí un conteo en
    // cero no probaría nada.
    await expect(toBuy.getByText(MATERIAL_NAME)).toHaveCount(0);

    await page.getByRole('tab', { name: /comprados/i }).click();
    const bought = page.getByRole('tabpanel', { name: /comprados/i });
    await expect(bought.getByText(MATERIAL_NAME)).toBeVisible();

    // Desde el resumen de la obra: la card de Compras tiene las mismas
    // pestañas, y el material lleva a su fila, ya en la pestaña que corresponde.
    await page.goto(page.url().replace(/\/materiales$/, ''));
    await page.getByRole('tab', { name: /comprados/i }).click();
    await page
      .getByRole('tabpanel', { name: /comprados/i })
      .getByRole('link', { name: MATERIAL_NAME })
      .click();
    await expect(page).toHaveURL(/\/materiales\?material=/);
    await expect(page.getByRole('tab', { name: /comprados/i })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('li[aria-current="true"]')).toContainText(MATERIAL_NAME);
  });
});
