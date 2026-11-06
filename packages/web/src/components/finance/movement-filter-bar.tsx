import { X } from 'lucide-react';
import { SearchField } from '@/components/common/search-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * La barra de filtros de los dos listados de plata —gastos y cobros—: buscador,
 * un filtro por tipo (la categoría del gasto, el método del cobro), rango de
 * fechas y "agrupar por". Es una sola para que las dos pantallas se manejen
 * igual; cada una le pasa sus opciones y sus textos.
 *
 * Va en el `toolbar` de `PageLayout`: es lo que dicen las reglas de la pantalla.
 */
export interface MovementFilterBarProps<Kind extends string, Group extends string> {
  search: string;
  onSearchChange: (value: string) => void;
  kind: {
    value: Kind | 'all';
    onChange: (value: Kind | 'all') => void;
    options: { value: Kind; label: string }[];
    allLabel: string;
    ariaLabel: string;
  };
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  groupBy: {
    value: Group;
    onChange: (value: Group) => void;
    options: { value: Group; label: string }[];
    ariaLabel: string;
  };
  activeCount: number;
  onClear: () => void;
  labels: { search: string; from: string; to: string; clear: string };
}

export function MovementFilterBar<Kind extends string, Group extends string>({
  search,
  onSearchChange,
  kind,
  from,
  to,
  onFromChange,
  onToChange,
  groupBy,
  activeCount,
  onClear,
  labels,
}: MovementFilterBarProps<Kind, Group>) {
  return (
    <>
      <SearchField
        wrapperClassName="w-full sm:w-56"
        className="h-10"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={labels.search}
        aria-label={labels.search}
      />
      <Select value={kind.value} onValueChange={(value) => kind.onChange(value as Kind | 'all')}>
        <SelectTrigger className="h-10 w-full sm:w-44" aria-label={kind.ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{kind.allLabel}</SelectItem>
          {kind.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        className="h-10 w-[calc(50%-0.25rem)] sm:w-40"
        value={from}
        max={to || undefined}
        onChange={(event) => onFromChange(event.target.value)}
        aria-label={labels.from}
      />
      <Input
        type="date"
        className="h-10 w-[calc(50%-0.25rem)] sm:w-40"
        value={to}
        min={from || undefined}
        onChange={(event) => onToChange(event.target.value)}
        aria-label={labels.to}
      />
      <Select value={groupBy.value} onValueChange={(value) => groupBy.onChange(value as Group)}>
        <SelectTrigger className="h-10 w-full sm:w-48" aria-label={groupBy.ariaLabel}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groupBy.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeCount > 0 && (
        <Button type="button" variant="ghost" className="h-10 max-sm:min-h-11" onClick={onClear}>
          <X className="size-4" />
          {labels.clear}
        </Button>
      )}
    </>
  );
}
