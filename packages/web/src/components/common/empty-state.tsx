import { useState, type ComponentType, type ReactNode } from 'react';
import { BellArt, ChecklistArt, NotFoundArt, WalletArt } from './empty-state-art';
import { cn } from '@/lib/utils';
import { useSuprimirAccionPrincipal } from '@/layouts/primary-action-context';

/**
 * Los cuatro tipos de vacío que tiene la app. No son cuatro dibujos: son
 * cuatro *situaciones* distintas, y por eso el componente pide la variante y no
 * una imagen suelta.
 *
 * - `list`   — todavía no hay nada cargado. Es el caso normal de una cuenta
 *              recién creada, y el único donde el vacío es una oportunidad.
 * - `money`  — no hay movimientos ni planes. Vacío de plata.
 * - `notifications` — nada que avisar. Vacío que está bien que exista.
 * - `error`  — algo se rompió o la ruta no existe. NO es un vacío: es una falla,
 *              y por eso tiene su propia ilustración.
 */
export type EmptyStateVariant = 'list' | 'money' | 'notifications' | 'error';

/**
 * Cada variante trae su ilustración y el SVG que la reemplaza si falta.
 *
 * La imagen se referencia por URL desde `public/` en vez de importarse: un
 * `import` de un archivo que todavía no está rompe el build entero. Si el
 * archivo no existe, `onError` cae al SVG y la pantalla sigue funcionando —
 * así el componente sirve con o sin las ilustraciones finales.
 *
 * El `width`/`height` es el tamaño intrínseco del archivo y no el que se ve en
 * pantalla: sirve para que el browser reserve la caja antes de bajar la imagen
 * y el texto de abajo no salte cuando termina de cargar.
 */
const ART: Record<
  EmptyStateVariant,
  { src: string; width: number; height: number; Art: ComponentType<{ className?: string }> }
> = {
  list:          { src: '/empty-states/checklist.webp', width: 498, height: 403, Art: ChecklistArt },
  money:         { src: '/empty-states/wallet.webp',    width: 441, height: 435, Art: WalletArt },
  notifications: { src: '/empty-states/bell.webp',      width: 335, height: 266, Art: BellArt },
  error:         { src: '/empty-states/error.webp',     width: 530, height: 443, Art: NotFoundArt },
};

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  /** Qué puede hacer la persona. Un vacío sin salida es una pared. */
  description?: string;
  /** Acción principal — cargar el primero, reintentar, volver. */
  action?: ReactNode;
  /** Acción secundaria, si el vacío se resuelve de más de una forma. */
  secondaryAction?: ReactNode;
  /**
   * El `action` de este vacío ES la acción principal de la pantalla. Mientras
   * el vacío esté en pantalla, el botón flotante del layout se esconde: dos
   * botones con la misma etiqueta compiten por ser "el" botón y ninguno gana.
   *
   * Va sólo en el vacío de "todavía no hay nada". En el de "el filtro no
   * matcheó" la salida es limpiar el filtro, que no es lo mismo que crear, y
   * ahí el flotante sigue haciendo falta.
   */
  replacesPrimaryAction?: boolean;
  className?: string;
}

/**
 * Estado vacío, uno para todas las listas de la app.
 *
 * Si cada vista resuelve su vacío por su cuenta, termina con un texto centrado
 * y sin ninguna acción, justo en el momento en que la persona más necesita que
 * le digan qué hacer.
 */
export function EmptyState({
  variant = 'list',
  title,
  description,
  action,
  secondaryAction,
  replacesPrimaryAction = false,
  className,
}: EmptyStateProps) {
  const { src, width, height, Art } = ART[variant];
  const [sinImagen, setSinImagen] = useState(false);

  useSuprimirAccionPrincipal(replacesPrimaryAction && Boolean(action));

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className,
      )}
      data-testid={`empty-state-${variant}`}
    >
      {/*
        La ilustración va sobre una superficie clara propia, no sobre el fondo
        de la pantalla.

        Los dibujos son línea gris oscura sobre transparencia: contra el fondo
        del tema oscuro los contornos se pierden y queda una mancha roja
        flotando. Por eso este gris NO usa `bg-muted` ni invierte con el tema —
        es la hoja sobre la que está dibujada la ilustración, y tiene que seguir
        siendo clara en los dos temas. Además disimula el borde de las imágenes,
        que no están recortadas al pixel.

        Es un disco de 160px fijo con la ilustración centrada en los dos ejes:
        los dibujos no comparten proporción entre sí, así que fijar la caja —y
        no la imagen— es lo único que hace que todos los vacíos de la app
        ocupen el mismo lugar.
      */}
      <div className="flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100">
        {sinImagen ? (
          <Art className="max-h-28 max-w-28 w-auto" />
        ) : (
          <img
            src={src}
            alt=""
            aria-hidden="true"
            // El alt vacío es a propósito: la ilustración no agrega información
            // que el título no diga ya, y anunciarla sería ruido.
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            className="max-h-28 max-w-28 w-auto object-contain"
            onError={() => setSinImagen(true)}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold">{title}</h3>
        {description && (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
