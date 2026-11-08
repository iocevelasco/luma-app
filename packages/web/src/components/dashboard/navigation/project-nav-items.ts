import {
  CalendarRange,
  Calculator,
  FileText,
  Flag,
  HardHat,
  LayoutDashboard,
  Package,
  Receipt,
  Sparkles,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '@luma/shared';
import {
  projectActivitiesPath,
  projectAdvisorPath,
  projectBudgetPath,
  projectDetailPath,
  projectDocumentsPath,
  projectExpensesPath,
  projectInventoryPath,
  projectLaborPath,
  projectMaterialsPath,
  projectMilestonesPath,
  projectPaymentsPath,
  projectProvidersPath,
  projectTeamPath,
} from '@/lib/routes';

/**
 * Las secciones de una obra. **Fuente única**: la usan el sidebar de desktop
 * y la tira scrolleable de mobile. Dos listas se desincronizan en el primer
 * cambio, y el síntoma es una sección que existe en una navegación y en la
 * otra no.
 *
 * El orden es el del trabajo, no el alfabético: primero cómo viene la obra,
 * después lo que se carga a diario, al final plata y administración —que se
 * miran con otra frecuencia y por otra gente.
 */
/**
 * Bloques del riel. `milestones` y `documents` son grupos de una sola sección:
 * destinos propios, con el nombre y el ícono de la sección. `labor` junta Personal y
 * Equipo (la gente que trabaja y la que tiene acceso a la obra).
 */
export type ProjectNavGroup = 'overview' | 'work' | 'milestones' | 'labor' | 'supply' | 'money' | 'documents';

export interface ProjectNavItem {
  /** Clave i18n bajo `project.nav`. */
  labelKey: string;
  /** Bloque del riel de desktop: los grupos se separan con una línea. */
  group: ProjectNavGroup;
  path: (projectId: string) => string;
  icon: LucideIcon;
  /**
   * Capacidad que hace falta para verla. `undefined` = la ven todos los que
   * tienen acceso a la obra.
   *
   * No es seguridad: el gate real está en la API. Acá sólo evita ofrecer una
   * pantalla que terminaría en 403 —o peor, en una pantalla vacía sin
   * explicación.
   */
  capability?: Capability;
  /**
   * Fuera de la navegación por ahora. La ruta y la página siguen existiendo
   * (una URL directa abre la pantalla, y el título del header la resuelve):
   * sólo se deja de ofrecerla en el sidebar y en la tira de mobile.
   */
  hidden?: boolean;
}

export const PROJECT_NAV_ITEMS: ProjectNavItem[] = [
  { labelKey: 'detail', group: 'overview', path: projectDetailPath, icon: LayoutDashboard },
  { labelKey: 'activities', group: 'work', path: projectActivitiesPath, icon: CalendarRange, capability: 'activity.read' },
  { labelKey: 'milestones', group: 'milestones', path: projectMilestonesPath, icon: Flag, capability: 'milestone.read' },
  { labelKey: 'labor', group: 'labor', path: projectLaborPath, icon: Users, capability: 'crew.read' },
  { labelKey: 'team', group: 'labor', path: projectTeamPath, icon: UserCog, capability: 'project.invite' },
  { labelKey: 'materials', group: 'supply', path: projectMaterialsPath, icon: Package, capability: 'material.read' },
  { labelKey: 'providers', group: 'supply', path: projectProvidersPath, icon: Wrench, capability: 'provider.read' },
  { labelKey: 'inventory', group: 'supply', path: projectInventoryPath, icon: Warehouse, capability: 'inventory.read' },
  { labelKey: 'payments', group: 'money', path: projectPaymentsPath, icon: Wallet, capability: 'payment.read' },
  { labelKey: 'expenses', group: 'money', path: projectExpensesPath, icon: Receipt, capability: 'expense.read' },
  { labelKey: 'budget', group: 'money', path: projectBudgetPath, icon: Calculator, capability: 'budget.read' },
  { labelKey: 'documents', group: 'documents', path: projectDocumentsPath, icon: FileText, capability: 'document.read' },
  {
    labelKey: 'advisor',
    group: 'documents',
    path: projectAdvisorPath,
    icon: Sparkles,
    capability: 'advisor.use',
    // Oculto por ahora: no está listo para mostrarse al cliente.
    hidden: true,
  },
];

/** Las secciones que este rol puede ver en esta obra, en orden. */
export function visibleProjectNavItems(capabilities: readonly Capability[]): ProjectNavItem[] {
  const granted = new Set(capabilities);
  return PROJECT_NAV_ITEMS.filter(
    (item) => !item.hidden && (!item.capability || granted.has(item.capability)),
  );
}

/**
 * Si la sección está activa en esta URL. Cuenta también lo que cuelga de ella
 * (`hitos/nuevo`, `hitos/:id/editar`): adentro del alta se sigue estando en
 * Hitos. El detalle es la excepción porque es prefijo de todas las demás.
 */
export function isProjectSectionActive(
  item: ProjectNavItem,
  projectId: string,
  pathname: string,
): boolean {
  const to = item.path(projectId);
  if (pathname === to) return true;
  return item.labelKey !== 'detail' && pathname.startsWith(`${to}/`);
}

/**
 * Los destinos del riel de desktop: uno por grupo, con sus secciones como
 * pestañas arriba de la pantalla (`ProjectSectionTabs`). Sin grupos vacíos: un
 * rol que no ve nada de "dinero" no tiene ese destino. La tira de mobile sigue
 * usando la lista plana.
 */
export interface ProjectNavGroupEntry {
  group: ProjectNavGroup;
  icon: LucideIcon;
  items: ProjectNavItem[];
}

const GROUP_ICONS: Partial<Record<ProjectNavGroup, LucideIcon>> = {
  overview: LayoutDashboard,
  work: HardHat,
  labor: Users,
  supply: Package,
  money: Wallet,
};

export function projectNavGroups(capabilities: readonly Capability[]): ProjectNavGroupEntry[] {
  const byGroup = new Map<ProjectNavGroup, ProjectNavItem[]>();
  for (const item of visibleProjectNavItems(capabilities)) {
    byGroup.set(item.group, [...(byGroup.get(item.group) ?? []), item]);
  }
  return [...byGroup.entries()].map(([group, items]) => ({
    group,
    // Sin ícono de grupo = destino de una sola sección: usa el de la sección.
    icon: GROUP_ICONS[group] ?? items[0].icon,
    items,
  }));
}

/**
 * Claves i18n del nombre y del tooltip de un destino del riel. Un grupo de una sola
 * sección (Hitos, Documentación) se nombra como ella; el resto tiene nombre propio.
 */
export function projectGroupTextKeys({ group, items }: ProjectNavGroupEntry): { label: string; hint: string } {
  const single = group === 'milestones' || group === 'documents';
  return single
    ? { label: `project.nav.${items[0].labelKey}`, hint: `project.navHint.${items[0].labelKey}` }
    : { label: `project.nav.groups.${group}`, hint: `project.navHint.groups.${group}` };
}

/** Todos los destinos, sin filtrar por permisos: para explicar qué hay (el recorrido de bienvenida). */
export function allProjectNavGroups(): ProjectNavGroupEntry[] {
  const all = PROJECT_NAV_ITEMS.flatMap((item) => (item.capability ? [item.capability] : []));
  return projectNavGroups(all);
}
