import { useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DASHBOARD_DESTINATIONS, type DashboardDestination } from './dashboard-destinations';
import { NavRailItem } from './nav-rail-item';

function DashboardRailItem({ labelKey, to, icon, testId, prefix }: DashboardDestination) {
  const { t } = useTranslation();
  const isActive = Boolean(useMatch({ path: to, end: !prefix }));

  return (
    <NavRailItem
      to={to}
      end={!prefix}
      icon={icon}
      label={t(`layout.${labelKey}`)}
      description={t(`layout.hints.${labelKey}`)}
      isActive={isActive}
      testId={testId}
    />
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
