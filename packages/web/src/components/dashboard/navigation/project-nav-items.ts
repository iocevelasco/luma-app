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
}

export const PROJECT_NAV_ITEMS: ProjectNavItem[] = [
  { labelKey: 'detail', path: projectDetailPath, icon: LayoutDashboard },
  { labelKey: 'gantt', path: projectActivitiesPath, icon: CalendarRange, capability: 'activity.read' },
  { labelKey: 'materials', path: projectMaterialsPath, icon: Package, capability: 'material.read' },
  { labelKey: 'labor', path: projectLaborPath, icon: Users, capability: 'crew.read' },
  { labelKey: 'milestones', path: projectMilestonesPath, icon: Flag, capability: 'milestone.read' },
  { labelKey: 'documents', path: projectDocumentsPath, icon: FileText, capability: 'document.read' },
  { labelKey: 'providers', path: projectProvidersPath, icon: Wrench, capability: 'provider.read' },
  { labelKey: 'payments', path: projectPaymentsPath, icon: Wallet, capability: 'payment.read' },
  { labelKey: 'expenses', path: projectExpensesPath, icon: Receipt, capability: 'expense.read' },
  { labelKey: 'budget', path: projectBudgetPath, icon: Calculator, capability: 'budget.read' },
  { labelKey: 'advisor', path: projectAdvisorPath, icon: Sparkles, capability: 'advisor.use' },
  { labelKey: 'team', path: projectTeamPath, icon: UserCog, capability: 'project.invite' },
];

/** Las secciones que este rol puede ver en esta obra, en orden. */
export function visibleProjectNavItems(capabilities: readonly Capability[]): ProjectNavItem[] {
  const granted = new Set(capabilities);
  return PROJECT_NAV_ITEMS.filter((item) => !item.capability || granted.has(item.capability));
}
