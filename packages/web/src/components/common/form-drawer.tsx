import type { FormEventHandler, ReactNode } from 'react';
import { FormShell } from '@/components/common/form-shell';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * Panel lateral único para toda la edición de la app.
 *
 * Antes cada CRUD abría su propio `Dialog` con su propio ancho, su propio pie
 * y su propio botón de guardar. Con diez entidades eso son diez criterios
 * distintos para la misma acción. Acá vive uno solo.
 *
 * Dos modos:
 * - **Formulario** (con `onSubmit`): el drawer arma el `<form>`, el pie y el
 *   botón de guardar. Quien lo usa sólo pone los campos.
 * - **Panel** (sin `onSubmit`): sólo la caja con su ancho y su scroll, para
 *   pantallas que mezclan una lista con un alta (el roster, las actividades
 *   de un proveedor) y manejan sus propias acciones.
 */
export type FormDrawerSize = 'sm' | 'md' | 'lg';

/**
 * El ancho sale de cuántos campos tiene el formulario. Un alta de un campo en
 * medio monitor se ve vacía; una de doce en un panel angosto obliga a
 * scrollear de más.
 *
 * `50vw` con tope: en un monitor ancho, la mitad de la pantalla para cuatro
 * campos es una caja enorme con aire al pedo, así que el tope manda. En una
 * laptop el que manda es el 50%.
 */
const WIDTH_BY_SIZE: Record<FormDrawerSize, string> = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
};

export function sizeForFieldCount(fieldCount: number): FormDrawerSize {
  if (fieldCount <= 4) return 'sm';
  if (fieldCount <= 8) return 'md';
  return 'lg';
}

interface FormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Cuántos campos tiene el form: de acá sale el ancho. */
  fieldCount?: number;
  /** Gana sobre `fieldCount`. Para paneles, donde contar campos no dice nada. */
  size?: FormDrawerSize;
  /** Con esto el drawer arma el `<form>` y el pie con las acciones. */
  onSubmit?: FormEventHandler<HTMLFormElement>;
  submitLabel?: string;
  isSubmitting?: boolean;
  /** Apaga el submit mientras no haya cambios. Ver `FormShell`. */
  isDirty?: boolean;
  /** El error crudo de la mutación. El shell lo resuelve — ver `FormShell`. */
  error?: unknown;
  children: ReactNode;
}

export function FormDrawer({
  open,
  onOpenChange,
  title,
  description,
  fieldCount,
  size,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  isDirty,
  error,
  children,
}: FormDrawerProps) {
  const resolvedSize = size ?? (fieldCount ? sizeForFieldCount(fieldCount) : 'md');

  const body = <div className="flex flex-col gap-4 px-4 pb-4">{children}</div>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Ancho completo en celular: media pantalla en un teléfono no
          // alcanza para un formulario, y la obra se opera desde el celular.
          'flex w-full flex-col gap-0 p-0 sm:w-[50vw]',
          WIDTH_BY_SIZE[resolvedSize],
        )}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        {onSubmit ? (
          /*
            El pie y los estados los pone `FormShell`, el mismo que usan las
            páginas de alta. Antes el drawer tenía su propio pie y su propio
            criterio de "guardando": dos implementaciones de lo mismo que ya
            habían empezado a divergir.
          */
          <FormShell
            variant="embedded"
            onSubmit={onSubmit}
            submitLabel={submitLabel}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
            isDirty={isDirty}
            error={error}
          >
            <div className="pt-4">{body}</div>
          </FormShell>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pt-4">{body}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default FormDrawer;
