import type { ReactNode } from 'react';
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
   * diálogo (el checkout de Stripe: captcha, 3D Secure). Con React Aria el
   * diálogo sigue siendo modal (atrapa el foco); `false` sólo hace que tocar
   * afuera no cierre: se cierra con la X, Escape o deslizando. Sin verificar
   * contra un checkout real de Stripe.
   */
  modal?: boolean;
}

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

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" modal={modal}>
        {/* 85vh y no 100: dejar ver un poco del fondo es lo que comunica que
            esto se cierra deslizando hacia abajo. */}
        <DrawerContent className={cn('max-h-[85vh]', className)}>
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
      <DialogContent className={cn('sm:max-w-lg', className)}>
        <DialogHeader className={hideHeader ? 'sr-only' : undefined}>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
