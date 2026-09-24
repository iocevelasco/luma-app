import { NavLink, useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DASHBOARD_DESTINATIONS, type DashboardDestination } from './dashboard-destinations';

/**
 * `TooltipTrigger asChild` clona el `NavLink` vía el `Slot` de Radix, y el
 * merge de props de `Slot` asume que `className` es un string: si es la
 * función `({isActive}) => ...` que acepta `NavLink`, `Slot` la mete en un
 * `.join(' ')` junto al resto y termina serializando el *código fuente* de
 * la función como clase — ninguna clase de Tailwind real llega a aplicarse
 * (por eso el ícono no se centraba: `flex` nunca se activaba). La resolución
 * de `isActive` tiene que vivir afuera, en un string ya armado.
 */
function DashboardRailItem({ labelKey, to, icon: Icon, testId, prefix }: DashboardDestination) {
  const { t } = useTranslation();
  const isActive = Boolean(useMatch({ path: to, end: !prefix }));

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          end={!prefix}
          data-testid={testId}
          className={cn(
            'flex size-11 items-center justify-center rounded-full transition-colors',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          <Icon className="size-5" />
          <span className="sr-only">{t(`layout.${labelKey}`)}</span>
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">{t(`layout.${labelKey}`)}</TooltipContent>
    </Tooltip>
  );
}

/** Riel lateral, sólo desktop. En mobile la navegación es la barra de abajo. */
export function DashboardRail() {
  const { t } = useTranslation();

  return (
    <nav
      aria-label={t('layout.openMenu')}
      className="hidden w-16 shrink-0 flex-col items-center gap-2 border-r border-border bg-card py-4 md:flex"
    >
      {DASHBOARD_DESTINATIONS.map((destination) => (
        <DashboardRailItem key={destination.to} {...destination} />
      ))}
    </nav>
  );
}
