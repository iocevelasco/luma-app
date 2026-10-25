import {
  CalendarRange,
  Calculator,
  FileText,
  Flag,
  LayoutDashboard,
  Package,
  Receipt,
  Sparkles,
  UserCog,
  Users,
  Wallet,
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
export interface ProjectNavItem {
  /** Clave i18n bajo `project.nav`. */
  labelKey: string;
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
  { labelKey: 'detail', path: projectDetailPath, icon: LayoutDashboard },
  { labelKey: 'activities', path: projectActivitiesPath, icon: CalendarRange, capability: 'activity.read' },
  { labelKey: 'materials', path: projectMaterialsPath, icon: Package, capability: 'material.read' },
  { labelKey: 'labor', path: projectLaborPath, icon: Users, capability: 'crew.read' },
  { labelKey: 'milestones', path: projectMilestonesPath, icon: Flag, capability: 'milestone.read' },
  { labelKey: 'documents', path: projectDocumentsPath, icon: FileText, capability: 'document.read' },
  { labelKey: 'providers', path: projectProvidersPath, icon: Wrench, capability: 'provider.read' },
  { labelKey: 'payments', path: projectPaymentsPath, icon: Wallet, capability: 'payment.read' },
  { labelKey: 'expenses', path: projectExpensesPath, icon: Receipt, capability: 'expense.read' },
  { labelKey: 'budget', path: projectBudgetPath, icon: Calculator, capability: 'budget.read' },
  {
    labelKey: 'advisor',
    path: projectAdvisorPath,
    icon: Sparkles,
    capability: 'advisor.use',
    // Oculto por ahora: no está listo para mostrarse al cliente.
    hidden: true,
  },
  { labelKey: 'team', path: projectTeamPath, icon: UserCog, capability: 'project.invite' },
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
