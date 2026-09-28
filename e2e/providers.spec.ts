import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';

/**
 * Flujo completo del directorio de proveedores (electricidad, carpintería,
 * etc.): registra su cuenta, crea una obra, prueba el CRUD completo del
 * directorio (crear, listar, editar, dar de baja), lo asigna a DOS
 * actividades distintas —confirma que la relación es N:N en los dos
 * sentidos: una actividad con varios proveedores y un proveedor en varias
 * actividades—, lo desasigna de una sin afectar la otra, y confirma que
 * también aparece en la vista de resumen de la obra.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const OWNER_NAME = `Ejecutante E2E ${RUN_ID}`;
const OWNER_EMAIL = `e2e-providers-${RUN_ID}@luma.test`;
const PASSWORD = 'E2eProyecto1234!';
const PROJECT_NAME = `Obra proveedores ${RUN_ID}`;
const ACTIVITY_NAME = `Instalación eléctrica ${RUN_ID}`;
const ACTIVITY_NAME_2 = `Tablero principal ${RUN_ID}`;
const PROVIDER_NAME = `Juan Electricista ${RUN_ID}`;
const PROVIDER_PHONE_UPDATED = '11-9999-9999';

function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

test.describe('directorio de proveedores', () => {
  test('CRUD completo, y asignación N:N a actividades en los dos sentidos', async ({ page }) => {
    await registerWith(page, OWNER_NAME, OWNER_EMAIL, PASSWORD);
    await loginWith(page, OWNER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(PROJECT_NAME);
    await page.locator('#description').fill('Obra para probar el directorio de proveedores.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.locator('#budgetType').click();
    await page.getByRole('option', { name: /cerrado/i }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
    const projectDetailUrl = page.url();

    // Resumen: sin proveedores todavía, la card muestra el vacío.
    await expect(page.getByText(/todavía no cargaste proveedores/i)).toBeVisible();

    // --- CRUD: crear ---
    await page.getByRole('link', { name: /^proveedores$/i }).click();
    await expect(page).toHaveURL(/\/proveedores$/);

    await page.getByRole('button', { name: /nuevo proveedor/i }).click();
    await page.locator('#provider-name').fill(PROVIDER_NAME);
    await page.locator('#provider-specialty').click();
    await page.getByRole('option', { name: /^electricidad$/i }).click();
    await page.locator('#provider-phone').fill('11-5555-5555');
    await page.getByRole('button', { name: /crear proveedor/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    // ResponsiveTable renderiza la fila dos veces (tabla desktop + tarjeta
    // mobile) y sólo una es visible según el viewport — `.first()` toma la
    // del DOM (la tabla desktop, visible en el viewport por default de Playwright).
    await expect(page.getByText(PROVIDER_NAME).first()).toBeVisible();

    // --- CRUD: editar ---
    await page.getByRole('button', { name: /^editar proveedor$/i }).first().click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await editDialog.locator('#edit-provider-phone').fill(PROVIDER_PHONE_UPDATED);
    await editDialog.getByRole('button', { name: /^guardar$/i }).click();
    await expect(editDialog).toBeHidden();
    await expect(page.getByText(PROVIDER_PHONE_UPDATED).first()).toBeVisible();

    // --- Resumen: ahora sí lista el proveedor recién creado ---
    await page.goto(projectDetailUrl);
    await expect(page.getByText(PROVIDER_NAME).first()).toBeVisible();
    await expect(page.getByText(/^electricidad$/i).first()).toBeVisible();

    // Crea DOS actividades para asignarles el mismo proveedor.
    await page.getByRole('link', { name: /^cronograma$/i }).click();
    await expect(page).toHaveURL(/\/actividades$/);

    const today = new Date();
    const start = toDayKey(today);
    const end = toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));

    for (const name of [ACTIVITY_NAME, ACTIVITY_NAME_2]) {
      await page.getByRole('button', { name: /nueva actividad/i }).click();
      await page.locator('#activity-name').fill(name);
      await page.locator('#activity-area').fill('Planta baja');
      await page.locator('#activity-start').fill(start);
      await page.locator('#activity-end').fill(end);
      await page.locator('#activity-responsible').fill('Juan Pérez');
      await page.getByRole('button', { name: /crear actividad/i }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    }

    // Asigna el proveedor a la primera actividad.
    await page.getByRole('gridcell', { name: ACTIVITY_NAME, exact: true }).click();
    let detailDialog = page.getByRole('dialog');
    await expect(detailDialog.getByText(ACTIVITY_NAME)).toBeVisible();
    await detailDialog.getByText(/todavía no asignaste proveedores/i).waitFor();
    await detailDialog.getByRole('combobox').click();
    await page.getByRole('option', { name: PROVIDER_NAME }).click();
    await detailDialog.getByRole('button', { name: /^asignar$/i }).click();
    await expect(detailDialog.getByText(PROVIDER_NAME)).toBeVisible();
    await detailDialog.getByRole('button', { name: /atrás/i }).click();
    await expect(detailDialog).toBeHidden();

    // Mismo proveedor, ahora a la segunda actividad — confirma N:N: un
    // proveedor puede estar en varias actividades a la vez.
    await page.getByRole('gridcell', { name: ACTIVITY_NAME_2, exact: true }).click();
    detailDialog = page.getByRole('dialog');
    await expect(detailDialog.getByText(ACTIVITY_NAME_2)).toBeVisible();
    await detailDialog.getByText(/todavía no asignaste proveedores/i).waitFor();
    await detailDialog.getByRole('combobox').click();
    await page.getByRole('option', { name: PROVIDER_NAME }).click();
    await detailDialog.getByRole('button', { name: /^asignar$/i }).click();
    await expect(detailDialog.getByText(PROVIDER_NAME)).toBeVisible();
    await detailDialog.getByRole('button', { name: /atrás/i }).click();
    await expect(detailDialog).toBeHidden();

    // Desasigna de la primera actividad — confirma que la relación es
    // independiente por actividad: la segunda no se ve afectada.
    await page.getByRole('gridcell', { name: ACTIVITY_NAME, exact: true }).click();
    detailDialog = page.getByRole('dialog');
    await expect(detailDialog.getByText(PROVIDER_NAME)).toBeVisible();
    await detailDialog.getByRole('button', { name: /quitar proveedor/i }).click();
    await expect(detailDialog.getByText(/todavía no asignaste proveedores/i)).toBeVisible();
    await detailDialog.getByRole('button', { name: /atrás/i }).click();
    await expect(detailDialog).toBeHidden();

    await page.getByRole('gridcell', { name: ACTIVITY_NAME_2, exact: true }).click();
    detailDialog = page.getByRole('dialog');
    await expect(detailDialog.getByText(PROVIDER_NAME)).toBeVisible();
    await detailDialog.getByRole('button', { name: /atrás/i }).click();
    await expect(detailDialog).toBeHidden();

    // --- CRUD: dar de baja ---
    await page.getByRole('link', { name: /^proveedores$/i }).click();
    await expect(page).toHaveURL(/\/proveedores$/);
    // Mismo duplicado tabla/tarjeta que arriba.
    await page.getByRole('button', { name: /dar de baja/i }).first().click();
    await page.getByRole('button', { name: /^continuar$/i }).click();
    // Espera al estado vacío en vez de "el nombre ya no aparece": la
    // invalidación de la query tarda un round-trip, y mientras tanto
    // `getByText` puede resolver a las dos filas (tabla + tarjeta) a la vez —
    // el vacío es un único elemento, sin ese problema de modo estricto.
    await expect(page.getByText(/todavía no cargaste proveedores/i)).toBeVisible({
      timeout: 10_000,
    });

    // El proveedor dado de baja sigue apareciendo donde ya estaba asignado
    // (trazabilidad — ver comentario en models/Provider.ts).
    await page.goto(page.url().replace(/\/proveedores$/, '/actividades'));
    await page.getByRole('gridcell', { name: ACTIVITY_NAME_2, exact: true }).click();
    detailDialog = page.getByRole('dialog');
    await expect(detailDialog.getByText(PROVIDER_NAME)).toBeVisible();
  });

  test('asigna actividades desde el lado del proveedor (al crear y desde el listado)', async ({
    page,
  }) => {
    const runId = `${RUN_ID}-b`;
    const ownerEmail = `e2e-providers-${runId}@luma.test`;
    const projectName = `Obra proveedores B ${runId}`;
    const activityA = `Actividad A ${runId}`;
    const activityB = `Actividad B ${runId}`;
    const providerName = `María Electricista ${runId}`;

    await registerWith(page, `Ejecutante E2E ${runId}`, ownerEmail, PASSWORD);
    await loginWith(page, ownerEmail, PASSWORD);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: /crear tu primera obra/i }).click();
    await page.locator('#name').fill(projectName);
    await page.locator('#description').fill('Obra para probar la asignación desde el proveedor.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.locator('#budgetType').click();
    await page.getByRole('option', { name: /cerrado/i }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    // Dos actividades: una se asigna al crear el proveedor (C), la otra desde
    // el diálogo del listado (B).
    await page.getByRole('link', { name: /^cronograma$/i }).click();
    await expect(page).toHaveURL(/\/actividades$/);

    const today = new Date();
    const start = toDayKey(today);
    const end = toDayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2));

    for (const name of [activityA, activityB]) {
      await page.getByRole('button', { name: /nueva actividad/i }).click();
      await page.locator('#activity-name').fill(name);
      await page.locator('#activity-area').fill('Planta baja');
      await page.locator('#activity-start').fill(start);
      await page.locator('#activity-end').fill(end);
      await page.locator('#activity-responsible').fill('Juan Pérez');
      await page.getByRole('button', { name: /crear actividad/i }).click();
      await expect(page.getByRole('dialog')).toBeHidden();
    }

    // --- C: crear el proveedor y asignarlo a la Actividad A de una ---
    await page.getByRole('link', { name: /^proveedores$/i }).click();
    await expect(page).toHaveURL(/\/proveedores$/);

    await page.getByRole('button', { name: /nuevo proveedor/i }).click();
    const createDialog = page.getByRole('dialog');
    await page.locator('#provider-name').fill(providerName);
    await page.locator('#provider-specialty').click();
    await page.getByRole('option', { name: /^electricidad$/i }).click();
    await page.locator('#provider-phone').fill('11-2222-2222');
    await createDialog.getByText(activityA, { exact: true }).click();
    await page.getByRole('button', { name: /crear proveedor/i }).click();
    await expect(createDialog).toBeHidden();

    // Confirma desde el lado de la Actividad que C efectivamente asignó.
    await page.getByRole('link', { name: /^cronograma$/i }).click();
    await expect(page).toHaveURL(/\/actividades$/);
    await page.getByRole('gridcell', { name: activityA, exact: true }).click();
    let activityDetail = page.getByRole('dialog');
    await expect(activityDetail.getByText(providerName)).toBeVisible();
    await activityDetail.getByRole('button', { name: /atrás/i }).click();
    await expect(activityDetail).toBeHidden();

    // --- B: desde el listado de Proveedores, asigna la Actividad B ---
    await page.getByRole('link', { name: /^proveedores$/i }).click();
    await expect(page).toHaveURL(/\/proveedores$/);

    await page
      .getByRole('button', { name: new RegExp(`^Actividades de ${providerName}$`, 'i') })
      .first()
      .click();
    const activitiesDialog = page.getByRole('dialog');
    await expect(activitiesDialog.getByText(activityA, { exact: true })).toBeVisible();

    await activitiesDialog.getByRole('combobox').click();
    await page.getByRole('option', { name: activityB, exact: true }).click();
    await activitiesDialog.getByRole('button', { name: /^asignar$/i }).click();
    await expect(activitiesDialog.getByText(activityB, { exact: true })).toBeVisible();

    // Desasigna la Actividad A desde acá mismo — confirma que el diálogo del
    // proveedor también puede quitar, no sólo agregar.
    await activitiesDialog
      .getByText(activityA, { exact: true })
      .locator('..')
      .locator('..')
      .getByRole('button', { name: /quitar actividad/i })
      .click();
    await expect(activitiesDialog.getByText(activityA, { exact: true })).toBeHidden();
    await activitiesDialog.getByRole('button', { name: /close/i }).click();

    // Confirma la simetría: Actividad A ya no lo tiene, Actividad B sí.
    await page.getByRole('link', { name: /^cronograma$/i }).click();
    await expect(page).toHaveURL(/\/actividades$/);
    await page.getByRole('gridcell', { name: activityA, exact: true }).click();
    activityDetail = page.getByRole('dialog');
    await expect(activityDetail.getByText(/todavía no asignaste proveedores/i)).toBeVisible();
    await activityDetail.getByRole('button', { name: /atrás/i }).click();
    await expect(activityDetail).toBeHidden();

    await page.getByRole('gridcell', { name: activityB, exact: true }).click();
    activityDetail = page.getByRole('dialog');
    await expect(activityDetail.getByText(providerName)).toBeVisible();
  });

  test('la libreta se reusa entre obras, el proveedor del cliente no', async ({ page }) => {
    const runId = `${RUN_ID}-c`;
    const ownerEmail = `e2e-providers-${runId}@luma.test`;
    const projectA = `Obra A ${runId}`;
    const projectB = `Obra B ${runId}`;
    const libraryProvider = `Electricista de siempre ${runId}`;
    const clientProvider = `Cristalería del cliente ${runId}`;

    async function createProject(name: string, firstOne: boolean) {
      await page
        .getByRole('link', { name: firstOne ? /crear tu primera obra/i : /nueva obra/i })
        .click();
      await page.locator('#name').fill(name);
      await page.locator('#description').fill('Obra para probar el alcance de proveedores.');
      await page.locator('#location').fill('CABA');
      await page.locator('#estimatedStartDate').fill('2026-09-01');
      await page.locator('#estimatedEndDate').fill('2026-12-15');
      await page.locator('#currency').click();
      await page.getByRole('option', { name: 'ARS' }).click();
      await page.locator('#budgetType').click();
      await page.getByRole('option', { name: /cerrado/i }).click();
      await page.getByRole('button', { name: /crear obra/i }).click();
      await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);
    }

    async function createProvider(name: string, specialty: RegExp, onlyThisProject: boolean) {
      await page.getByRole('button', { name: /nuevo proveedor/i }).click();
      const dialog = page.getByRole('dialog');
      await page.locator('#provider-name').fill(name);
      await page.locator('#provider-specialty').click();
      await page.getByRole('option', { name: specialty }).click();
      if (onlyThisProject) {
        await page.locator('#provider-scope').click();
        await page.getByRole('option', { name: /solo esta obra/i }).click();
      }
      await page.locator('#provider-phone').fill('11-3333-3333');
      await page.getByRole('button', { name: /crear proveedor/i }).click();
      await expect(dialog).toBeHidden();
    }

    await registerWith(page, `Ejecutante E2E ${runId}`, ownerEmail, PASSWORD);
    await loginWith(page, ownerEmail, PASSWORD);

    // Obra A: uno de la libreta y uno que "trae el cliente".
    await createProject(projectA, true);
    await page.getByRole('link', { name: /^proveedores$/i }).click();
    await expect(page).toHaveURL(/\/proveedores$/);
    await createProvider(libraryProvider, /^electricidad$/i, false);
    await createProvider(clientProvider, /^cristalería$/i, true);

    await expect(page.getByText(libraryProvider).first()).toBeVisible();
    await expect(page.getByText(clientProvider).first()).toBeVisible();
    await expect(page.getByText(/solo esta obra/i).first()).toBeVisible();

    // Obra B: sólo tiene que ver el de la libreta. Se vuelve por URL: "Obras"
    // aparece dos veces (breadcrumb y riel) y no vale la pena desambiguar.
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
    await createProject(projectB, false);
    await page.getByRole('link', { name: /^proveedores$/i }).click();
    await expect(page).toHaveURL(/\/proveedores$/);

    await expect(page.getByText(libraryProvider).first()).toBeVisible();
    await expect(page.getByText(clientProvider)).toHaveCount(0);
  });
});
