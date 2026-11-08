import { expect, type Page } from '@playwright/test';

/**
 * Las secciones de una obra y el grupo del riel al que pertenece cada una.
 *
 * En una obra el riel muestra grupos (`project-group-<grupo>`) y las secciones de cada grupo
 * son pestañas arriba (`project-nav-<sección>`), que sólo existen cuando el grupo tiene más
 * de una sección visible para el rol. Es el mismo mapa de `project-nav-items.ts`.
 */
export type Section =
  | 'detail'
  | 'activities'
  | 'milestones'
  | 'labor'
  | 'team'
  | 'materials'
  | 'providers'
  | 'inventory'
  | 'payments'
  | 'expenses'
  | 'budget'
  | 'documents';

const GROUP_OF: Record<Section, string> = {
  detail: 'overview',
  activities: 'work',
  milestones: 'milestones',
  labor: 'labor',
  team: 'labor',
  materials: 'supply',
  providers: 'supply',
  inventory: 'supply',
  payments: 'money',
  expenses: 'money',
  budget: 'money',
  documents: 'documents',
};

/** Los grupos con una sola sección posible: no tienen pestañas. */
const SINGLE_GROUPS = new Set(['overview', 'work', 'milestones', 'documents']);

/**
 * Abre una sección como lo hace una persona: el grupo del riel y, si la sección no es la primera
 * del grupo, su pestaña.
 */
export async function openSection(page: Page, section: Section) {
  await page.getByTestId(`project-group-${GROUP_OF[section]}`).click();
  if (SINGLE_GROUPS.has(GROUP_OF[section])) return;
  const tab = page.getByTestId(`project-nav-${section}`);
  // La primera sección del grupo es adonde lleva el riel: su pestaña ya está elegida.
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
}

/** La sección está a la vista del rol (como grupo del riel o como pestaña del grupo). */
export async function expectSectionVisible(page: Page, section: Section) {
  const group = GROUP_OF[section];
  await expect(page.getByTestId(`project-group-${group}`)).toBeVisible();
  if (SINGLE_GROUPS.has(group)) return;
  await page.getByTestId(`project-group-${group}`).click();
  await expect(page.getByTestId(`project-nav-${section}`)).toBeVisible();
}

/** La sección no existe para el rol: ni el grupo, o el grupo sin esa pestaña. */
export async function expectSectionHidden(page: Page, section: Section) {
  const group = GROUP_OF[section];
  const groupLink = page.getByTestId(`project-group-${group}`);
  if (SINGLE_GROUPS.has(group)) {
    await expect(groupLink).toHaveCount(0);
    return;
  }
  // Con otras secciones del grupo a la vista, hay que abrirlo para ver que falta su pestaña.
  if ((await groupLink.count()) === 0) return;
  await groupLink.click();
  await expect(page.getByTestId(`project-nav-${section}`)).toHaveCount(0);
}
