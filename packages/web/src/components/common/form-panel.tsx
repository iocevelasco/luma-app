import { useEffect, useState, type FormEventHandler, type ReactNode } from 'react';
import { Dialog, Heading } from 'react-aria-components/Dialog';
import { Modal, ModalOverlay } from 'react-aria-components/Modal';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FormShell } from '@/components/common/form-shell';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useContentArea } from '@/components/layout/content-area-context';

/**
 * Superficie de edición para formularios largos: tapa el área de contenido
 * del panel de borde a borde y deja el sidebar y el header a la vista.
 *
 * **Cuándo usar esto y cuándo `FormDrawer`.** El drawer sigue siendo la
 * superficie de los formularios de campos sueltos. Éste es para los que
 * tienen texto largo o adjuntos —una minuta de reunión— y no entran en un
 * panel lateral sin scrollear de más. Si dudás, es el drawer.
 *
 * Diferencias con el drawer:
 *
 * - **Lo abre una ruta, no un estado.** Montado = abierto. Así sobrevive a
 *   una recarga, el "atrás" del celular lo cierra y se puede compartir un
 *   link que lo abra directo. Cerrar es navegar: eso lo decide `onClose`.
 * - **Pide confirmación antes de descartar.** En un drawer de cuatro campos
 *   perder lo escrito cuesta poco; acá puede ser una minuta de una hora. Lo
 *   mismo al recargar la pestaña, con el aviso nativo del navegador.
 * - **Clickear afuera no cierra.** Afuera es la navegación, y un click
 *   distraído en el sidebar no puede tirar lo escrito.
 *
 * El pie es el mismo `FormShell` de toda la app: un solo lugar define cómo se
 * ve y se comporta "guardar".
 */
interface FormPanelProps {
  title: string;
  description?: string;
  /** Navegar afuera del panel. Se llama recién cuando no hay nada que perder. */
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitLabel?: string;
  isSubmitting?: boolean;
  /** Apaga el submit mientras no haya cambios — ver `FormShell`. Sólo en edición. */
  isDirty?: boolean;
  /** Si hay algo escrito que se perdería al cerrar. Dispara la confirmación. */
  hasUnsavedChanges: boolean;
  /** El error crudo de la mutación. El shell lo resuelve — ver `FormShell`. */
  error?: unknown;
  children: ReactNode;
}

export function FormPanel({
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  isSubmitting = false,
  isDirty,
  hasUnsavedChanges,
  error,
  children,
}: FormPanelProps) {
  const { t } = useTranslation();
  const contentArea = useContentArea();
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  // Recargar o cerrar la pestaña con cambios: el único aviso posible ahí es
  // el nativo. El texto lo pone el navegador; no se puede personalizar.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome viejo y Safari todavía lo piden para mostrar el aviso.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedChanges]);

  const requestClose = () => {
    if (isSubmitting) return;
    if (hasUnsavedChanges) setConfirmingDiscard(true);
    else onClose();
  };

  // El nodo del área de contenido existe recién después del primer render
  // del layout. Sin él, el portal caería en `body` y en desktop taparía
  // también el sidebar.
  if (!contentArea) return null;

  return (
    <>
      {/*
        ADR-003: no hay equivalente en HeroUI (un panel que tapa sólo el área de
        contenido), así que va sobre las primitivas de React Aria que HeroUI usa.
        Siempre abierto (`isOpen`): Escape pide cerrar, pero cerrar es `requestClose`.
        `UNSTABLE_portalContainer` lleva el panel al área de contenido.
      */}
      <ModalOverlay
        isOpen
        onOpenChange={(open) => !open && requestClose()}
        isDismissable={false}
        UNSTABLE_portalContainer={contentArea}
        // En el celular tapa todo, header incluido: en 375px no queda área
        // de contenido que valga la pena dejar a la vista. En desktop, sólo
        // el área de contenido — por eso `absolute` dentro del portal.
        className="fixed inset-0 z-50 md:absolute md:z-40"
      >
        <Modal className="h-full w-full">
          <Dialog
            // Sin descripción no hay `aria-describedby` que enlazar.
            aria-label={title}
            className="relative flex h-full flex-col bg-background pb-[env(safe-area-inset-bottom)] outline-none"
          >
          <div className="absolute top-3 right-3 z-20 md:top-4 md:right-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={requestClose}
              aria-label={t('formPanel.close')}
            >
              <X className="size-5" />
            </Button>
          </div>

          {/*
            `bare`, como el alta de obra: el cuerpo scrollea por su cuenta y
            el pie queda abajo con las acciones centradas. El formulario es
            una columna angosta y centrada; el pie va de borde a borde.
          */}
          <FormShell
            variant="bare"
            onSubmit={onSubmit}
            onCancel={requestClose}
            submitLabel={submitLabel}
            isSubmitting={isSubmitting}
            isDirty={isDirty}
            error={error}
          >
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4">
              <div className="flex flex-col gap-1 pt-6 pr-10 md:pt-10">
                <Heading slot="title" className="text-xl">
                  {title}
                </Heading>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
              {children}
            </div>
          </FormShell>
          </Dialog>
        </Modal>
      </ModalOverlay>

      <AlertDialog open={confirmingDiscard} onOpenChange={setConfirmingDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('formPanel.discard.title')}</AlertDialogTitle>
            <AlertDialogDescription>{t('formPanel.discard.description')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('formPanel.discard.keepEditing')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmingDiscard(false);
                onClose();
              }}
            >
              {t('formPanel.discard.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default FormPanel;
