import { ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { ROUTES } from '@/lib/routes';

interface TermsDialogProps {
  open: boolean;
  /** Acepta. El diálogo no se cierra solo: quien llama decide qué pasa después. */
  onAccept: () => void;
  isPending: boolean;
  /** Texto ya resuelto de la falla al guardar: va como banner pegado al botón. */
  error?: string | null;
  /** Texto del botón: crear cuenta, activar, continuar. */
  confirmLabel: string;
  /**
   * Con `onCancel` el diálogo se puede cerrar (registro y activación: la
   * persona todavía puede arrepentirse). Sin él es obligatorio — es el caso de
   * quien ya tiene cuenta y tiene que aceptar para seguir usando el panel.
   */
  onCancel?: () => void;
}

/**
 * El aviso de seguridad y confidencialidad más la aceptación de los Términos y
 * la Política de Privacidad. La casilla nace sin marcar y el botón no se
 * habilita hasta marcarla: aceptar es un acto, no un valor por defecto.
 */
export function TermsDialog({
  open,
  onAccept,
  isPending,
  error,
  confirmLabel,
  onCancel,
}: TermsDialogProps) {
  const { t } = useTranslation();
  const checkboxId = useId();
  const [checked, setChecked] = useState(false);

  const points = t('legal.dialog.points', { returnObjects: true }) as string[];

  const body = (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        {points.map((point) => (
          <li key={point} className="flex gap-2">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-3 rounded-md border border-border p-3">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(value) => setChecked(value === true)}
          className="mt-0.5"
        />
        <Label htmlFor={checkboxId} className="text-sm leading-snug font-normal">
          <span>
            {t('legal.dialog.checkboxBefore')}{' '}
            <a
              href={ROUTES.LEGAL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline underline-offset-2"
            >
              {t('legal.dialog.checkboxLink')}
            </a>
            {t('legal.dialog.checkboxAfter')}
          </span>
        </Label>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            {t('common.cancel')}
          </Button>
        )}
        <Button type="button" onClick={onAccept} disabled={!checked || isPending}>
          {isPending ? t('common.loading') : confirmLabel}
        </Button>
      </div>
    </div>
  );

  if (onCancel) {
    return (
      <ResponsiveDialog
        open={open}
        onOpenChange={(next) => !next && !isPending && onCancel()}
        title={t('legal.dialog.title')}
        description={t('legal.dialog.description')}
      >
        {body}
      </ResponsiveDialog>
    );
  }

  // Obligatorio: AlertDialog no trae la X ni se cierra tocando afuera, y Escape
  // lo bloquea el propio componente. Es lo que se necesita acá.
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('legal.dialog.titleUpdated')}</AlertDialogTitle>
          <AlertDialogDescription>{t('legal.dialog.descriptionUpdated')}</AlertDialogDescription>
        </AlertDialogHeader>
        {body}
      </AlertDialogContent>
    </AlertDialog>
  );
}
