import { Building2, HardHat, Truck, Users, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/lib/routes';

/**
 * Destinos del panel. Fuente única: la usan el riel de desktop y la barra de
 * mobile. Si cada navegación arma su propia lista, se desincronizan en el
 * primer cambio.
 *
 * Obras, Proveedores y Empleados van al mismo nivel: los dos últimos son de la
 * Empresa y se comparten entre obras, no pertenecen a una. El orden es el de
 * uso: a las obras se entra todos los días, a la Empresa cuando entra alguien
 * nuevo. Por eso la Empresa es un destino y no una
 * sección al final de la home: ahí quedaba debajo del listado de obras, que
 * crece, y con unas cuantas obras ya había que scrollear para encontrarla.
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
    labelKey: 'projects',
    to: ROUTES.ADMIN,
    icon: HardHat,
    testId: 'nav-home',
  },
  {
    labelKey: 'providers',
    to: ROUTES.PROVIDERS,
    icon: Truck,
    testId: 'nav-providers',
  },
  {
    labelKey: 'crew',
    to: ROUTES.CREW,
    icon: Users,
    testId: 'nav-crew',
  },
  {
    labelKey: 'company',
    to: ROUTES.COMPANY,
    icon: Building2,
    testId: 'nav-company',
  },
];
