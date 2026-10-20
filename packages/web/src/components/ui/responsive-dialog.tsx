import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

/**
 * Diálogo en desktop, drawer desde abajo en mobile.
 *
 * Un diálogo centrado en un teléfono deja el contenido lejos del pulgar y, con
 * el teclado abierto, se corta. Sin un wrapper, cada componente termina
 * escribiendo su propio `useIsMobile()` + `isMobile ? <Drawer> : <Dialog>`, y
 * las copias divergen. Todo diálogo de la app nace sobre esto.
 */
export interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Se aplica al contenedor en las dos variantes. */
  className?: string;
  /**
   * Oculta el encabezado visualmente pero lo deja para lectores de pantalla.
   * Radix exige un título accesible aunque el diseño no lo muestre.
   */
  hideHeader?: boolean;
  /**
   * `false` para contenido de terceros que abre sus propias capas fuera del
   * diálogo (el checkout de Stripe: captcha, 3D Secure). Un diálogo modal
   * atrapa el foco y bloquea los clics fuera de él, y esas capas quedan
   * inutilizables. Sin modal se dibuja igual el fondo oscuro, pero tocar
   * afuera no cierra: se cierra con la X, Escape o deslizando.
   */
  modal?: boolean;
}

/** Fondo de un diálogo no modal: Radix sólo dibuja el suyo en modo modal. */
function NonModalBackdrop() {
  return createPortal(
    <div aria-hidden className="fixed inset-0 z-50 bg-black/50" />,
    document.body,
  );
}

/** Que tocar afuera (o que el foco se vaya a un iframe de afuera) no cierre. */
const stayOpen = {
  onInteractOutside: (event: Event) => event.preventDefault(),
  onFocusOutside: (event: Event) => event.preventDefault(),
};

export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  hideHeader,
  modal = true,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();
  const nonModal = modal ? {} : stayOpen;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" modal={modal}>
        {!modal && open && <NonModalBackdrop />}
        {/* 85vh y no 100: dejar ver un poco del fondo es lo que comunica que
            esto se cierra deslizando hacia abajo. */}
        <DrawerContent className={cn('max-h-[85vh]', className)} {...nonModal}>
          <DrawerHeader className={hideHeader ? 'sr-only' : 'text-left'}>
            <DrawerTitle>{title}</DrawerTitle>
            {description ? <DrawerDescription>{description}</DrawerDescription> : null}
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-4">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={modal}>
      {!modal && open && <NonModalBackdrop />}
      <DialogContent className={cn('sm:max-w-lg', className)} {...nonModal}>
        <DialogHeader className={hideHeader ? 'sr-only' : undefined}>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
