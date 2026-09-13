import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DASHBOARD_DESTINATIONS } from './dashboard-destinations';

/** Riel lateral, sólo desktop. En mobile la navegación es la barra de abajo. */
export function DashboardRail() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('layout.openMenu')}
      className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-border bg-card py-4 md:flex"
    >
      {DASHBOARD_DESTINATIONS.map(({ labelKey, to, icon: Icon, testId, prefix }) => (
        <Tooltip key={to}>
          <TooltipTrigger asChild>
            <NavLink
              to={to}
              end={!prefix}
              data-testid={testId}
              className={({ isActive }) =>
                cn(
                  'flex size-11 items-center justify-center rounded-full transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <Icon className="size-5" />
              <span className="sr-only">{t(`layout.${labelKey}`)}</span>
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{t(`layout.${labelKey}`)}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  );
}
