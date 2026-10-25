import { expect, test } from '@playwright/test';
import { loginWith, registerWith } from './helpers/auth';
import { addCrewMember, addTask, boardColumn, moveTask, openBoard, taskCard } from './helpers/crew';
import { requiresApi } from './helpers/api';

/**
 * Personal fijo de obra y tareas: cargar el roster desde el drawer de Personal
 * (persona, equipo y encargado de especialidad), asignarle una tarea desde el
 * Tablero de Actividades, completarla, y confirmar que vive en sus fechas y no
 * se filtra a la semana siguiente.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const RUN_ID = Date.now();
const PASSWORD = 'E2eProyecto1234!';

requiresApi();

test.describe('personal fijo y tareas', () => {
  test('carga el roster, le asigna una tarea y la completa', async ({ page }) => {
    const ownerEmail = `e2e-crew-${RUN_ID}@luma.test`;
    const projectName = `Obra personal ${RUN_ID}`;
    const leadName = `Martín Acosta ${RUN_ID}`;
    const teamName = `Cuadrilla ${RUN_ID}`;
    const goalText = `Terminar el revoque ${RUN_ID}`;

    await registerWith(page, `Ejecutante E2E ${RUN_ID}`, ownerEmail, PASSWORD);
    await loginWith(page, ownerEmail, PASSWORD);

    await page.getByRole('link', { name: /nueva obra/i }).click();
    await page.locator('#name').fill(projectName);
    await page.locator('#description').fill('Obra para probar personal y metas.');
    await page.locator('#location').fill('CABA');
    await page.locator('#estimatedStartDate').fill('2026-09-01');
    await page.locator('#estimatedEndDate').fill('2026-12-15');
    await page.locator('#currency').click();
    await page.getByRole('option', { name: 'ARS' }).click();
    await page.getByRole('button', { name: /crear obra/i }).click();
    await expect(page).toHaveURL(/\/admin\/proyectos\/[a-f0-9]+$/);

    const projectUrl = page.url();

    // Sin personal, el Tablero lo dice: no hay a quién asignarle tareas.
    await openBoard(page, projectUrl);
    await expect(page.getByText(/sumá personal a la obra para asignarle tareas/i)).toBeVisible();

    // Personal es la asistencia del día: arriba va el resumen de la obra.
    await page.getByRole('link', { name: /^personal$/i }).click();
    await expect(page).toHaveURL(/\/personal$/);
    await expect(page.getByText(/^presentes$/i)).toBeVisible();
    await expect(page.getByText(/tareas hoy/i)).toBeVisible();

    // --- Roster: un encargado de especialidad y un equipo, desde el drawer ---
    await addCrewMember(page, { name: leadName, specialty: /^electricidad$/i, isLead: true });
    await addCrewMember(page, { name: teamName, kind: /^equipo$/i });

    // El panel de personal fijo los lista, con la marca de encargado.
    await page.getByRole('button', { name: /^personal fijo$/i }).click();
    const roster = page.getByRole('dialog');
    await expect(roster.getByText(leadName)).toBeVisible();
    await expect(roster.getByText(/^encargado$/i)).toBeVisible();
    await expect(roster.getByText(teamName)).toBeVisible();
    await roster.getByRole('button', { name: /close/i }).click();
    await expect(roster).toBeHidden();

    // --- Una tarea para el equipo, desde el alta rápida del Tablero ---
    await openBoard(page, projectUrl);
    await addTask(page, teamName, goalText);
    await expect(boardColumn(page, /^pendiente$/i).getByRole('article', { name: goalText })).toBeVisible();
    await expect(taskCard(page, goalText)).toContainText(teamName);

    // --- El gerente la da por completada desde el menú de la tarjeta ---
    await moveTask(page, goalText, /mover a completada/i);
    await expect(
      boardColumn(page, /^completada$/i).getByRole('article', { name: goalText }),
    ).toBeVisible();

    // --- Dura hoy: no aparece en la semana siguiente ---
    await page.getByRole('button', { name: /semana siguiente/i }).click();
    await expect(page.getByText(goalText)).toHaveCount(0);

    // Y al volver sigue ahí, en la columna que le pusimos.
    await page.getByRole('button', { name: /semana actual/i }).click();
    await expect(
      boardColumn(page, /^completada$/i).getByRole('article', { name: goalText }),
    ).toBeVisible();
  });
});
