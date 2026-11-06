import type { ComponentProps, ReactNode } from 'react';
import { FormDrawer } from '@/components/common/form-drawer';
import { cn } from '@/lib/utils';

/**
 * El detalle de un gasto o de un cobro: un panel lateral con todo lo que se
 * registró, en la misma disposición para los dos. Usa el panel único de la app
 * (`FormDrawer` sin formulario).
 *
 * Cada pantalla arma sus campos —un gasto tiene categoría, proveedor y
 * comprobante; un cobro, método, referencia y cuota— y acá sólo se dibujan. Un
 * campo sin valor no se muestra: un renglón vacío dice que algo falta cuando
 * simplemente no se cargó.
 */
export interface MovementDetailField {
  label: string;
  value: ReactNode;
}

export function MovementDetail({
  open,
  onOpenChange,
  title,
  caption,
  amount,
  fields,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Qué es: la descripción del gasto, el concepto del cobro. */
  title: string;
  /** Una línea chica bajo el título: la fecha. */
  caption: string;
  /** El importe en la moneda de la obra, ya con su símbolo. */
  amount: string;
  fields: MovementDetailField[];
  /** Lo que va debajo de los campos (acciones, p. ej.). */
  children?: ReactNode;
}) {
  const visible = fields.filter((field) => field.value !== undefined && field.value !== null && field.value !== '' && field.value !== false);

  return (
    <FormDrawer open={open} onOpenChange={onOpenChange} title={title} description={caption} size="sm">
      <p className="text-3xl tabular-nums">{amount}</p>
      <dl className="flex flex-col gap-3 text-sm">
        {visible.map((field) => (
          <div key={field.label} className="flex flex-col gap-0.5 border-t border-border pt-3">
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="min-w-0 break-words">{field.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </FormDrawer>
  );
}

/**
 * El título de una fila como botón que abre el detalle. Estira su área clicable
 * a toda la tarjeta (`after:inset-0`), así que se toca en cualquier parte de la
 * fila; la fila tiene que ser `relative`, y los controles propios de la fila
 * (comprobante, borrar) van `relative z-10` para quedar por encima.
 */
export function RowOpenButton({ className, ...props }: ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'block max-w-full truncate text-left after:absolute after:inset-0 after:cursor-pointer after:rounded-2xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring',
        className,
      )}
      {...props}
    />
  );
}
