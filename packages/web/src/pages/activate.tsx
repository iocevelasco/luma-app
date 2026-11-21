import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { GoogleAuthSection } from '@/components/auth/google-auth-section';
import { PasswordForm } from '@/components/auth/password-form';
import { TermsDialog } from '@/components/legal/terms-dialog';
import { useSetPassword } from '@/hooks/auth/use-auth-queries';
import { errorMessage } from '@/lib/error-message';

/**
 * Activación: la cuenta la creó un admin y todavía no tiene contraseña. Al
 * terminar deja la sesión abierta — pedirle a la persona que vuelva a entrar
 * justo después de elegir su contraseña no agrega seguridad, sólo fricción.
 *
 * Quien llega por invitación nunca pasó por el registro: acá es donde acepta
 * los Términos, con el mismo diálogo.
 */
export function ActivatePage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const setPassword = useSetPassword();
  const [chosenPassword, setChosenPassword] = useState<string | null>(null);

  return (
    <AuthSplitLayout width="md">
      <AuthHeader title={t('auth.activate.title')} description={t('auth.activate.subtitle')} />
      <div className="flex flex-col gap-4">
        {token ? (
          <>
            <PasswordForm
              submitLabel={t('auth.activate.submit')}
              isPending={setPassword.isPending}
              onSubmit={setChosenPassword}
            />
            <p className="text-center text-xs text-muted-foreground">
              {t('legal.notice.body')}
            </p>
            {/*
              Con el token del enlace, Google activa esta cuenta invitada sin
              elegir contraseña, aunque el correo de Google sea otro.
            */}
            <GoogleAuthSection text="continue_with" divider activationToken={token} />
            <TermsDialog
              open={chosenPassword !== null}
              onCancel={() => {
                setChosenPassword(null);
                setPassword.reset();
              }}
              onAccept={() =>
                chosenPassword &&
                setPassword.mutate({ token, password: chosenPassword, acceptedTerms: true })
              }
              isPending={setPassword.isPending}
              error={errorMessage(setPassword.error, t)}
              confirmLabel={t('legal.dialog.confirmActivate')}
            />
          </>
        ) : (
          <p role="alert" className="text-sm text-destructive">
            {t('auth.resetPassword.missingToken')}
          </p>
        )}
      </div>
    </AuthSplitLayout>
  );
}

export default ActivatePage;
