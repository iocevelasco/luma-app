import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DateRange as DayPickerRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useDateLocale } from '@/hooks/use-date-locale';
import { cn } from '@/lib/utils';

/**
 * Rango de fechas como par de días calendario, `YYYY-MM-DD`, con `to`
 * INCLUSIVO.
 *
 * Se guarda como string y no como `Date` a propósito: un `Date` arrastra hora y
 * zona, y en cuanto viaja al query string se convierte a UTC. Para un usuario
 * en Argentina, `new Date('2026-08-13')` es el 12 a las 21:00, así que el rango
 * "13 al 13" pedido desde el navegador terminaba trayendo el día equivocado.
 * Acá el día es un día, y la conversión a instante la hace el backend en la
 * zona del usuario.
 */
export interface DateRange {
  from: string;
  to: string;
}

/** `YYYY-MM-DD` en hora LOCAL. `toISOString()` daría el día anterior en UTC-3. */
export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** Un `YYYY-MM-DD` de vuelta a Date local, para el calendario. */
export function fromDayKey(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export type DateRangePresetId = 'thisMonth' | 'lastMonth' | 'last30' | 'thisYear';

/**
 * Los cuatro rangos que se piden siempre. Están primero y a un click porque
 * "este mes" es el 90% de las veces: obligar a elegir dos fechas en un
 * calendario para ver el mes en curso es cobrar un peaje por el caso normal.
 */
export function presetRange(id: DateRangePresetId, hoy = new Date()): DateRange {
  const y = hoy.getFullYear();
  const m = hoy.getMonth();

  switch (id) {
    case 'thisMonth':
      return { from: toDayKey(new Date(y, m, 1)), to: toDayKey(new Date(y, m + 1, 0)) };
    case 'lastMonth':
      return { from: toDayKey(new Date(y, m - 1, 1)), to: toDayKey(new Date(y, m, 0)) };
    case 'last30': {
      const desde = new Date(hoy);
      desde.setDate(desde.getDate() - 29);
      return { from: toDayKey(desde), to: toDayKey(hoy) };
    }
    case 'thisYear':
      return { from: toDayKey(new Date(y, 0, 1)), to: toDayKey(new Date(y, 11, 31)) };
  }
}

const PRESETS: DateRangePresetId[] = ['thisMonth', 'lastMonth', 'last30', 'thisYear'];

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  /**
   * Por defecto el calendario no deja elegir fechas futuras: nació para
   * filtros de pagos y gastos ya ocurridos. Una obra planifica actividades a
   * futuro, así que ese caso lo pasa en `false`.
   */
  disableFuture?: boolean;
}

/**
 * Filtro de rango de fechas: presets a un click, calendario para lo demás.
 *
 * El rango se aplica recién al cerrar con las dos puntas elegidas. Aplicarlo en
 * cuanto hay una sola fecha dispararía una consulta por el rango de un día
 * suelto en el medio de cada selección, y la tabla parpadearía con datos que
 * nadie pidió.
 */
export function DateRangeFilter({ value, onChange, className, disableFuture = true }: DateRangeFilterProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();
  const [open, setOpen] = useState(false);
  const [borrador, setBorrador] = useState<DayPickerRange | undefined>();

  const seleccion: DayPickerRange = borrador ?? {
    from: fromDayKey(value.from),
    to: fromDayKey(value.to),
  };

  const fmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short' });
  const fmtConAnio = new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  // El año se muestra sólo cuando aporta: dentro del año corriente es ruido
  // repetido dos veces en un botón que compite por el ancho en mobile.
  const desde = fromDayKey(value.from);
  const hasta = fromDayKey(value.to);
  const mismoAnio = desde.getFullYear() === hasta.getFullYear();
  const esteAnio = mismoAnio && desde.getFullYear() === new Date().getFullYear();
  const etiqueta =
    value.from === value.to
      ? (esteAnio ? fmt : fmtConAnio).format(desde)
      : `${(esteAnio ? fmt : fmtConAnio).format(desde)} – ${(esteAnio ? fmt : fmtConAnio).format(hasta)}`;

  function aplicarPreset(id: DateRangePresetId) {
    setBorrador(undefined);
    onChange(presetRange(id));
    setOpen(false);
  }

  function handleSelect(rango: DayPickerRange | undefined) {
    setBorrador(rango);
    if (rango?.from && rango.to) {
      onChange({ from: toDayKey(rango.from), to: toDayKey(rango.to) });
      setBorrador(undefined);
      setOpen(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Un rango a medias no sobrevive al cierre: al reabrir mostraría una
        // selección que nunca se aplicó.
        if (!next) setBorrador(undefined);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('gap-2', className)}
          data-testid="date-range-filter"
        >
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          <span>{etiqueta}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col gap-1 border-b border-border p-2 sm:flex-row">
          {PRESETS.map((id) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start sm:justify-center"
              onClick={() => aplicarPreset(id)}
            >
              {t(`dateRange.${id}`)}
            </Button>
          ))}
        </div>

        <Calendar
          mode="range"
          numberOfMonths={1}
          defaultMonth={desde}
          selected={seleccion}
          onSelect={handleSelect}
          locale={dateLocale}
          // Un rango de caja hacia adelante no existe: no hay pagos futuros que
          // mostrar, y dejarlo elegible sólo produce tablas vacías.
          disabled={disableFuture ? { after: new Date() } : undefined}
        />
      </PopoverContent>
    </Popover>
  );
}
