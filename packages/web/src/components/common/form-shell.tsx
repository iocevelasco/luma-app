import type { FormEventHandler, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/error-message';
import { cn } from '@/lib/utils';

/**
 * El esqueleto de todo formulario de la app: cuerpo scrolleable y pie fijo
 * con las acciones.
 *
 * Existe porque el botón de guardar se escondía. En un formulario largo —el
 * alta de obra, el de gasto— las acciones vivían al final del contenido, así
 * que había que scrollear hasta el fondo para encontrarlas y no se veía que
 * existieran hasta llegar. El pie pegado las deja siempre a la vista.
 *
 * Lo usan las dos superficies de edición: las páginas de alta y
 * `FormDrawer`, que lo monta por dentro. Un solo lugar define cómo se ve y se
 * comporta "guardar" en toda la app.
 *
 * Estados que maneja, para que ninguna pantalla los resuelva a su manera:
 *
 * - **enviando** — deshabilita el submit y cambia la etiqueta. Sin esto, dos
 *   clicks rápidos mandan dos altas.
 * - **sin cambios** — con `isDirty`, el submit queda apagado hasta que haya
 *   algo que guardar.
 * - **error** — banner arriba del pie, pegado a la acción. El toast aparece
 *   en la esquina y la persona está mirando el botón que acaba de apretar.
 */
interface FormShellProps {
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  submitLabel?: string;
  /** Sin esto no se muestra botón de cancelar. */
  onCancel?: () => void;
  cancelLabel?: string;
  isSubmitting?: boolean;
  /**
   * Si viene, el submit se apaga mientras no haya cambios. Se omite en los
   * formularios de alta: ahí "sin cambios" es el estado inicial y apagar el
   * botón haría parecer que la pantalla está rota.
   */
  isDirty?: boolean;
  /**
   * El error crudo de la mutación — `mutation.error`, tal cual.
   *
   * Se pasa sin resolver a propósito: si cada formulario tuviera que
   * convertirlo en texto, cada uno elegiría un mensaje distinto para la misma
   * falla. El shell saca el del servidor, que es el único que sabe qué pasó.
   */
  error?: unknown;
  /**
   * Salidas para el error, adentro del banner: "sumarlo a esta obra" cuando
   * el alta chocó con alguien que ya existe. Un error que se puede resolver
   * con un click tiene que ofrecer ese click donde se lo lee.
   */
  errorActions?: ReactNode;
  /**
   * Para el drawer, que ya aporta su propia caja con scroll y bordes. En una
   * página el shell se encarga de todo eso.
   *
   * `bare` es la página sin tarjeta alrededor: el pie se pega al fondo del
   * contenedor sobre el fondo de la página, sin el sangrado de la card, y
   * lleva las acciones centradas.
   */
  variant?: 'page' | 'embedded' | 'bare';
  className?: string;
}

export function FormShell({
  onSubmit,
  children,
  submitLabel,
  onCancel,
  cancelLabel,
  isSubmitting = false,
  isDirty,
  error,
  errorActions,
  variant = 'page',
  className,
}: FormShellProps) {
  const { t } = useTranslation();
  // Resuelto por el único traductor de errores de la app: un mismo fallo dice
  // lo mismo en toda la app, y el texto sale del `code` de la API.
  const message = errorMessage(error, t);

  // `isDirty === undefined` significa "no me interesa": sólo bloquea cuando
  // quien usa el shell lo pidió explícitamente.
  const nothingToSave = isDirty === false;
  const disabled = isSubmitting || nothingToSave;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn('flex flex-col gap-4', variant !== 'embedded' && 'pb-4')}>{children}</div>
      </div>

      {/*
        `sticky bottom-0` y no `fixed`: pegado al pie del contenedor, no al del
        viewport. Adentro del drawer, un `fixed` se saldría del panel y
        quedaría flotando sobre la página de atrás.

        En `embedded` y `bare` NO es sticky: ahí el cuerpo ya scrollea por su
        cuenta y el pie es un hijo más de la columna, así que queda abajo sin
        ayuda. En `bare` además `sticky` falla: se cuenta desde el padding del
        `main` que scrollea, y el pie subía esa cantidad, tapando campos. Y
        `sticky` rompe en los diálogos: el navegador lo calcula antes del
        `translate-y-[-50%]` que centra el diálogo, así que cuando éste supera
        la mitad del alto de la pantalla el pie se sube y tapa los últimos
        campos.
      */}
      <div
        className={cn(
          'z-10 flex flex-col gap-3 border-t border-border',
          variant === 'page' ? 'sticky bottom-0' : 'relative',
          variant === 'bare' ? 'bg-background px-4 py-4' : 'bg-card',
          variant === 'page' && 'mt-4 -mx-6 px-6 py-4',
          variant === 'embedded' && 'p-4',
        )}
      >
        {/*
          El banner es el canal de los errores de guardado — no hay toast
          para esto. Va con relleno sólido y no con un tinte al 10%: cuando
          una acción falla, el aviso tiene que verse antes de leerse, igual
          que el toast de éxito. El `role="alert"` hace que el lector de
          pantalla lo anuncie sin que la persona tenga que ir a buscarlo.
        */}
        {message && (
          <div
            role="alert"
            className={cn(
              'flex items-start gap-2 rounded-md border border-destructive bg-destructive px-3 py-2 text-destructive-foreground',
              variant === 'bare' && 'mx-auto w-full max-w-2xl',
            )}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{t('errors.title')}</span>
              <span className="text-sm">{message}</span>
              {errorActions && <div className="mt-2 flex flex-wrap gap-2">{errorActions}</div>}
            </div>
          </div>
        )}

        <div className={cn('flex gap-2', variant === 'bare' ? 'justify-center' : 'justify-end')}>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              {cancelLabel ?? t('common.cancel')}
            </Button>
          )}
          <Button type="submit" disabled={disabled}>
            {isSubmitting ? t('common.loading') : (submitLabel ?? t('common.save'))}
          </Button>
        </div>
      </div>
    </form>
  );
}


export default FormShell;
