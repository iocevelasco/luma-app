import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TermsDialog } from '@/components/legal/terms-dialog';
import { useAcceptTerms, useCurrentUser } from '@/hooks/auth/use-auth-queries';
import { errorMessage } from '@/lib/error-message';
import { useAuth } from '@/providers/auth-provider';

/**
 * Tapa el panel con el diálogo de Términos mientras falte aceptar la versión
 * vigente: cuentas anteriores a los Términos y cada vez que el texto cambia
 * de fondo.
 *
 * El usuario de la sesión viene de localStorage y no se vuelve a pedir al
 * abrir la app, así que una versión nueva no llegaría nunca. Por eso se
 * consulta `/me` y, si la API dice otra cosa que lo guardado, se sincroniza.
 */
export function TermsGate() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const { data } = useCurrentUser();
  const accept = useAcceptTerms();

  const fresh = data?.user;
  useEffect(() => {
    if (fresh && fresh.terms_pending !== user?.terms_pending) updateUser(fresh);
  }, [fresh, user?.terms_pending, updateUser]);

  const pending = fresh ? fresh.terms_pending : user?.terms_pending === true;

  return (
    <TermsDialog
      open={pending}
      onAccept={() => accept.mutate()}
      isPending={accept.isPending}
      error={errorMessage(accept.error, t)}
      confirmLabel={t('legal.dialog.confirmContinue')}
    />
  );
}
