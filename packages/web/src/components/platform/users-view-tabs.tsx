import { BarChart3, Filter, ListChecks, Users, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/** Las vistas de la pantalla de cuentas, en el orden en que se leen. */
export const USERS_VIEWS = ['census', 'funnel', 'followUp', 'directory'] as const;
export type UsersView = (typeof USERS_VIEWS)[number];

const VIEW_ICON: Record<UsersView, LucideIcon> = {
  census: BarChart3,
  funnel: Filter,
  followUp: ListChecks,
  directory: Users,
};

/** Las pestañas que cambian de vista. Van siempre primero en la barra. */
export function UsersViewTabs({
  value,
  onChange,
}: {
  value: UsersView;
  onChange: (view: UsersView) => void;
}) {
  const { t } = useTranslation();

  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as UsersView)}>
      <TabsList>
        {USERS_VIEWS.map((view) => (
          <TabsTrigger key={view} value={view} icon={VIEW_ICON[view]}>
            {t(`platform.users.views.${view}`)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
