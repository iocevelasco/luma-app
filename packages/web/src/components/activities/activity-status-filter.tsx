import type { ActivityStatus } from '@luma/shared';
import { ListFilter } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FILTERABLE_ACTIVITY_STATUSES } from '@/lib/activity-status-filter';

/**
 * Filtro por estado del Cronograma. Selección múltiple: lo que se consulta en
 * obra suele ser un conjunto ("lo abierto" = pendiente + en curso), no un solo
 * estado. Vacío = todas.
 */
export function ActivityStatusFilter({
  value,
  onChange,
}: {
  value: ActivityStatus[];
  onChange: (next: ActivityStatus[]) => void;
}) {
  const { t } = useTranslation();
  const selected = new Set(value);

  const label =
    value.length === 0
      ? t('activity.gantt.statusFilter.all')
      : value.length === 1
        ? t(`activity.status.${value[0]}`)
        : t('activity.gantt.statusFilter.count', { count: value.length });

  function toggle(status: ActivityStatus, checked: boolean) {
    const next = new Set(selected);
    if (checked) next.add(status);
    else next.delete(status);
    onChange(FILTERABLE_ACTIVITY_STATUSES.filter((s) => next.has(s)));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          data-testid="activity-status-filter"
          aria-label={t('activity.gantt.statusFilter.aria')}
        >
          <ListFilter className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {FILTERABLE_ACTIVITY_STATUSES.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={selected.has(status)}
            onCheckedChange={(checked) => toggle(status, checked === true)}
            // Se marcan varios de una vez: cerrar el menú en cada clic obliga a
            // reabrirlo para el segundo.
            onSelect={(event) => event.preventDefault()}
          >
            {t(`activity.status.${status}`)}
          </DropdownMenuCheckboxItem>
        ))}
        {value.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])}>
              {t('activity.gantt.statusFilter.clear')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
