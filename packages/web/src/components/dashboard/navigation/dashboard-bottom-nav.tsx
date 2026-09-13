import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { DASHBOARD_DESTINATIONS } from './dashboard-destinations';

/**
 * Barra inferior, sólo mobile. Va fija: el pulgar llega ahí sin reacomodar la
 * mano, y el contenido de la página reserva su alto con un padding.
 */
export function DashboardBottomNav() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('layout.openMenu')}
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {DASHBOARD_DESTINATIONS.map(({ labelKey, to, icon: Icon, testId, prefix }) => (
        <NavLink
          key={to}
          to={to}
          end={!prefix}
          data-testid={`${testId}-mobile`}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )
          }
        >
          <Icon className="size-5" />
          {t(`layout.${labelKey}`)}
        </NavLink>
      ))}
    </nav>
  );
}
