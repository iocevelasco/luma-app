/**
 * Claves de TanStack Query, centralizadas.
 *
 * Todas llevan el proyecto adentro: sin eso, cambiar de proyecto mostraría la
 * caché del anterior durante un instante — y en una app donde cada proyecto
 * tiene su propio presupuesto, ese instante es un dato ajeno en pantalla.
 */
export const queryKeys = {
  session: ['session'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  members: (id: string) => ['project', id, 'members'] as const,
  dashboard: (id: string, week?: string) => ['project', id, 'dashboard', week ?? 'current'] as const,
  clientDashboard: (id: string) => ['project', id, 'client-dashboard'] as const,
  activities: (id: string, week?: string) => ['project', id, 'activities', week ?? 'all'] as const,
  materials: (id: string, status?: string) => ['project', id, 'materials', status ?? 'all'] as const,
  shoppingList: (id: string) => ['project', id, 'materials', 'shopping-list'] as const,
  workers: (id: string) => ['project', id, 'workers'] as const,
  attendance: (id: string, date: string) => ['project', id, 'attendance', date] as const,
  budgetStatus: (id: string) => ['project', id, 'budget', 'status'] as const,
  budgetCurrent: (id: string) => ['project', id, 'budget', 'current'] as const,
  contingencies: (id: string, status?: string) =>
    ['project', id, 'contingencies', status ?? 'all'] as const,
  contingency: (id: string, contingencyId: string) =>
    ['project', id, 'contingency', contingencyId] as const,
  notifications: (id: string) => ['project', id, 'notifications'] as const,
  conversations: (id: string) => ['project', id, 'conversations'] as const,
};
