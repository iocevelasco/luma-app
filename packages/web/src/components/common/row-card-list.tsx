import { type ComponentProps, type ReactNode } from 'react';
import { format, isSameYear } from 'date-fns';
import type { Locale } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Listas del panel: cada fila es su propia tarjeta.
 *
 * Una fila blanca sobre el lienzo apenas tintado, sin borde y con aire entre
 * una y otra: la separación la dan el fondo y el espacio, no una línea. Bajo
 * el puntero la fila sube (`shadow-lift`) y su acción visible se rellena, así
 * se sabe qué fila se está por tocar antes de tocarla.
 *
 * Los grupos de una misma lista (por tarea, por estado, por categoría) no son
 * otra caja: son un `ListSection`, rótulo + divisor. Si el grupo tuviera forma
 * de tarjeta se leería como una fila más.
 *
 * Reglas completas en DESIGN.md ("Listas") y en
 * docs/design/arquitectura-de-informacion.md (IA-15).
 */

/** Las clases de la fila, para lo que no puede ser un `<li>` (una celda de grilla, un botón). */
export const ROW_CARD =
  'group/row flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 text-sm text-card-foreground shadow-surface transition-shadow duration-200 hover:shadow-lift focus-within:shadow-lift sm:px-5';

/** El rótulo de un grupo: chico, en mayúsculas y atenuado, para que no se parezca a una fila. */
export const LIST_SECTION_LABEL = 'text-xs font-medium uppercase tracking-wide text-muted-foreground';

export function RowCardList({ className, ...props }: ComponentProps<'ul'>) {
  return <ul data-slot="row-card-list" className={cn('flex flex-col gap-3', className)} {...props} />;
}

export function RowCard({
  className,
  highlighted,
  ...props
}: ComponentProps<'li'> & {
  /** La fila a la que se llegó por un link (`?material=`): se marca con el anillo de foco. */
  highlighted?: boolean;
}) {
  return (
    <li
      data-slot="row-card"
      aria-current={highlighted || undefined}
      className={cn(ROW_CARD, highlighted && 'ring-2 ring-primary', className)}
      {...props}
    />
  );
}

/** Línea 1 (qué es) y línea 2 (metadatos), ocupando el ancho que sobra. */
export function RowCardBody({
  title,
  meta,
  className,
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-1 basis-48 flex-col gap-0.5', className)}>
      <div className="min-w-0 font-medium">{title}</div>
      {meta && <div className="min-w-0 text-xs text-muted-foreground">{meta}</div>}
      {children}
    </div>
  );
}

/**
 * El bloque derecho: estado, monto, acción y "…". En escritorio no se encoge.
 * En celular baja a su propia línea y la ocupa entera: lo primero (el estado o
 * el monto) queda a la izquierda y las acciones a la derecha. Si aun así no
 * entra, se parte en dos antes que salirse de la tarjeta. Todo control de
 * adentro mide 44px en celular.
 */
export function RowCardEnd({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 max-sm:w-full max-sm:[&>:first-child]:mr-auto sm:shrink-0 sm:flex-nowrap',
        // 44px en celular para todo lo que se toca, aunque la fila lo pida en `icon-sm`.
        'max-sm:[&_:is(button,a)]:min-h-11 max-sm:[&_:is(button,a)]:min-w-11',
        className,
      )}
      {...props}
    />
  );
}

const LEAD_TONE = {
  neutral: 'bg-muted text-foreground',
  brand: 'bg-primary/15 text-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-destructive/10 text-destructive',
} as const;

export type RowCardLeadTone = keyof typeof LEAD_TONE;

/**
 * El bloque de la izquierda: una fecha o un ícono, tintado. Va un escalón de
 * radio abajo de la fila (`rounded-xl` dentro de `rounded-2xl`).
 */
export function RowCardLead({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'div'> & { tone?: RowCardLeadTone }) {
  return (
    <div
      data-slot="row-card-lead"
      className={cn(
        'flex size-12 shrink-0 flex-col items-center justify-center rounded-xl text-center sm:size-14',
        LEAD_TONE[tone],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Una fecha en el bloque de la izquierda: el mes arriba, el día grande. El año
 * sólo si no es el corriente. La fila ya no repite la fecha en la línea 2.
 */
export function RowCardDate({
  date,
  locale,
  tone,
  label,
  className,
}: {
  date: Date;
  locale?: Locale;
  tone?: RowCardLeadTone;
  /** Qué fecha es, para el lector de pantalla ("Vence el 16 ene"), cuando el bloque solo no lo dice. */
  label?: string;
  className?: string;
}) {
  const otherYear = !isSameYear(date, new Date());

  return (
    <RowCardLead tone={tone} className={className}>
      <time dateTime={format(date, 'yyyy-MM-dd')} aria-label={label} className="flex flex-col items-center leading-none">
        <span className="text-2xs font-medium uppercase tracking-wide opacity-80">
          {format(date, otherYear ? 'MMM yyyy' : 'MMM', { locale })}
        </span>
        <span className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{format(date, 'd')}</span>
      </time>
    </RowCardLead>
  );
}

/**
 * La acción visible de la fila: el paso siguiente. Liviana en reposo y
 * rellena cuando la fila está bajo el puntero o tiene el foco. En celular
 * mide 44px.
 */
export function RowCardAction({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'border-transparent max-sm:min-h-11 group-hover/row:bg-foreground group-hover/row:text-background group-focus-within/row:bg-foreground group-focus-within/row:text-background hover:bg-foreground/85 hover:text-background',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Un grupo dentro de una lista: rótulo, divisor que corre hasta el borde y su
 * metadato (conteo, fecha, total) a la derecha. Las filas van debajo.
 */
export function ListSection({
  label,
  meta,
  leading,
  className,
  children,
}: {
  label: ReactNode;
  meta?: ReactNode;
  /** Antes del rótulo: la casilla del grupo, si la lista se selecciona. */
  leading?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  // Sin `aria-labelledby`: un grupo nombrado sería un landmark, y una lista
  // con seis grupos llenaría de regiones el índice del lector de pantalla.
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div className="flex min-h-6 flex-wrap items-center gap-x-3 gap-y-1">
        {leading}
        <h3 className={LIST_SECTION_LABEL}>
          {label}
        </h3>
        <div aria-hidden className="h-px min-w-6 flex-1 bg-border" />
        {meta && <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{meta}</div>}
      </div>
      {children}
    </section>
  );
}

/** Varios `ListSection` seguidos: el aire entre grupos es mayor que entre filas. */
export function ListSections({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-8', className)} {...props} />;
}
