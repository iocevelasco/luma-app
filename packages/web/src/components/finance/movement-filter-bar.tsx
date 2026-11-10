import { useState, type ReactNode } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { SearchField } from '@/components/common/search-field';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * La barra de filtros de los dos listados de plata —gastos y cobros—: buscador,
 * un filtro por tipo (la categoría del gasto, el método del cobro), rango de
 * fechas y "agrupar por". Es una sola para que las dos pantallas se manejen
 * igual; cada una le pasa sus opciones y sus textos.
 *
 * Va en el `toolbar` de `PageLayout`. Con lugar, todo en una sola línea (las
 * acciones de la pantalla van en `secondaryActions`, a la derecha). Sin lugar
 * (`compact`: celular y pantallas angostas) queda un solo botón "Filtros" y todo
 * —filtros y acciones— vive en su panel.
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
  labels: {
    search: string;
    from: string;
    to: string;
    clear: string;
    /** El botón del modo compacto y el título de su panel: "Filtros". */
    button: string;
    /** "Hecho", el pie del panel. */
    done: string;
    /** "Acciones", el rótulo del grupo de acciones del panel. */
    actions: string;
  };
  compact?: boolean;
  /** Las acciones de la pantalla (descargar, agregar…): sólo se dibujan en el modo compacto. */
  actions?: ReactNode;
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
  compact = false,
  actions,
}: MovementFilterBarProps<Kind, Group>) {
  const [open, setOpen] = useState(false);
  // En el panel cada control ocupa el ancho; en la barra, uno chico y de alto fijo.
  const height = compact ? 'h-11' : 'h-10';

  const fields = (
    <>
      <SearchField
        wrapperClassName={compact ? 'w-full' : 'min-w-24 flex-1 basis-0'}
        className={cn(height, compact && 'w-full')}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={labels.search}
        aria-label={labels.search}
        autoComplete="off"
      />
      <Select value={kind.value} onValueChange={(value) => kind.onChange(value as Kind | 'all')}>
        <SelectTrigger className={cn(height, compact ? 'w-full' : 'w-36 shrink-0')} aria-label={kind.ariaLabel}>
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
      <div className={cn('flex gap-2', compact ? 'w-full' : 'contents')}>
        <Input
          type="date"
          className={cn(height, compact ? 'min-w-0 flex-1' : 'w-[8.25rem] shrink-0')}
          value={from}
          max={to || undefined}
          onChange={(event) => onFromChange(event.target.value)}
          aria-label={labels.from}
        />
        <Input
          type="date"
          className={cn(height, compact ? 'min-w-0 flex-1' : 'w-[8.25rem] shrink-0')}
          value={to}
          min={from || undefined}
          onChange={(event) => onToChange(event.target.value)}
          aria-label={labels.to}
        />
      </div>
      <Select value={groupBy.value} onValueChange={(value) => groupBy.onChange(value as Group)}>
        <SelectTrigger className={cn(height, compact ? 'w-full' : 'w-40 shrink-0')} aria-label={groupBy.ariaLabel}>
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
    </>
  );

  if (compact) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button type="button" variant="outline" className="h-11" aria-label={labels.button}>
            <SlidersHorizontal className="size-4" />
            {labels.button}
            {activeCount > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-2xs font-medium tabular-nums text-primary-foreground">
                {activeCount}
              </span>
            )}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[88dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>{labels.button}</DrawerTitle>
            <DrawerDescription className="sr-only">{labels.search}</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
            {fields}
            {actions && (
              <fieldset className="mt-2 flex flex-col gap-2">
                <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.actions}
                </legend>
                {/* Tocar una acción cierra el panel: lo que abre (un formulario, una descarga) va encima. */}
                <div
                  className="flex flex-col gap-2 [&_button]:min-h-11 [&_button]:w-full [&_button]:justify-start"
                  onClick={() => setOpen(false)}
                >
                  {actions}
                </div>
              </fieldset>
            )}
          </div>
          <DrawerFooter className="flex-row gap-2">
            {activeCount > 0 && (
              <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={onClear}>
                <X className="size-4" />
                {labels.clear}
              </Button>
            )}
            <DrawerClose asChild>
              <Button type="button" className="min-h-11 flex-1">
                {labels.done}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <>
      {fields}
      {activeCount > 0 && (
        <Button type="button" variant="ghost" size="icon" className="size-10" aria-label={labels.clear} title={labels.clear} onClick={onClear}>
          <X className="size-4" />
        </Button>
      )}
    </>
  );
}
