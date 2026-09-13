import { Home, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/lib/routes';

/**
 * Destinos del panel. Fuente única: la usan el riel de desktop y la barra de
 * mobile. Si cada navegación arma su propia lista, se desincronizan en el
 * primer cambio.
 *
 * Hoy hay uno solo, y está bien que así sea: la base no tiene producto. Cuando
 * aparezcan los dominios reales, se agregan acá y las dos barras los toman.
 */
export interface DashboardDestination {
  /** Clave i18n bajo `layout`. */
  labelKey: string;
  to: string;
  icon: LucideIcon;
  testId: string;
  /** Prefijo que enciende el destino, si no coincide con `to`. */
  prefix?: string;
}

export const DASHBOARD_DESTINATIONS: DashboardDestination[] = [
  {
    labelKey: 'home',
    to: ROUTES.ADMIN,
    icon: Home,
    testId: 'nav-home',
  },
];
