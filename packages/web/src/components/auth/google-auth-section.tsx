import type { GoogleSignupDetails } from '@luma/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { TermsDialog } from '@/components/legal/terms-dialog';
import { Separator } from '@/components/ui/separator';
import { useGoogleAuth } from '@/hooks/auth/use-auth-queries';
import { usePublicConfig } from '@/hooks/public-config/use-public-config';
import { isApiError } from '@/lib/api-client';
import { errorMessage } from '@/lib/error-message';
import { ROUTES } from '@/lib/routes';

interface GoogleAuthSectionProps {
  /** Qué dice el botón: entrar, registrarse o continuar (activar). */
  text: 'signin_with' | 'signup_with' | 'continue_with';
  /**
   * En `/login`: la credencial queda en memoria tras un `GOOGLE_LINK_REQUIRED`
   * y, si la persona entra con su contraseña en ese momento, la misma pantalla
   * conecta Google (el camino corto del ADR-005 §1.12).
   */
  onLinkRequired?: (credential: string) => void;
  /** Un "o" arriba del botón. Va acá y no en la pantalla: sin Google, no queda un divisor suelto. */
  divider?: boolean;
  className?: string;
}

interface PendingSignup {
  credential: string;
  details: GoogleSignupDetails;
}

function signupDetails(error: unknown): GoogleSignupDetails | null {
  if (!isApiError(error) || error.code !== 'GOOGLE_SIGNUP_REQUIRED') return null;
  const details = error.details as Partial<GoogleSignupDetails> | undefined;
  return details?.email ? { email: details.email, name: details.name ?? '' } : null;
}

/**
 * Entrar o registrarse con Google: el botón, el alta con los Términos y los
 * avisos. El mismo bloque en `/login`, `/register` y `/activate`: la API no
 * necesita saber de qué pantalla viene.
 *
 * Sin la entrega configurada (`googleLogin: null`) no se dibuja nada.
 *
 * La credencial vive sólo en `useState` mientras se muestran los Términos:
 * nunca en storage ni en la URL.
 */
export function GoogleAuthSection({
  text,
  onLinkRequired,
  divider = false,
  className,
}: GoogleAuthSectionProps) {
  const { t } = useTranslation();
  const { data: config } = usePublicConfig();
  const google = useGoogleAuth();
  const [signup, setSignup] = useState<PendingSignup | null>(null);

  const clientId = config?.googleLogin?.clientId;
  if (!clientId) return null;

  const handleCredential = (credential: string) => {
    google.mutate(
      { credential },
      {
        onError: (error) => {
          const details = signupDetails(error);
          if (details) {
            setSignup({ credential, details });
            // El diálogo arranca limpio: este "falta aceptar" no es una falla.
            google.reset();
            return;
          }
          if (isApiError(error) && error.code === 'GOOGLE_LINK_REQUIRED') {
            onLinkRequired?.(credential);
          }
        },
      },
    );
  };

  const closeSignup = () => {
    setSignup(null);
    google.reset();
  };

  const linkRequired = isApiError(google.error) && google.error.code === 'GOOGLE_LINK_REQUIRED';
  const invited =
    linkRequired && (google.error as { details?: { reason?: string } }).details?.reason === 'invited';

  return (
    <div className={className}>
      {divider && (
        <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
          <Separator className="flex-1" />
          <span>{t('auth.or')}</span>
          <Separator className="flex-1" />
        </div>
      )}
      <GoogleSignInButton
        clientId={clientId}
        text={text}
        onCredential={handleCredential}
        disabled={google.isPending}
      />

      {/* Su propio aviso, separado del banner del formulario de contraseña. */}
      {google.isError && !signup && (
        <div role="alert" className="mt-3 flex flex-col gap-1">
          <p className="text-sm text-destructive">
            {invited ? t('errors.googleLinkInvited') : errorMessage(google.error, t)}
          </p>
          {linkRequired && !invited && !onLinkRequired && (
            <Link className="text-sm text-primary hover:underline" to={ROUTES.LOGIN}>
              {t('auth.google.goToLogin')}
            </Link>
          )}
        </div>
      )}

      <TermsDialog
        open={signup !== null}
        onCancel={closeSignup}
        onAccept={() =>
          signup && google.mutate({ credential: signup.credential, acceptedTerms: true })
        }
        isPending={google.isPending}
        error={signup ? errorMessage(google.error, t) : null}
        confirmLabel={t('legal.dialog.confirmCreate')}
        intro={
          signup && (
            <div className="flex flex-col gap-1 text-sm">
              <p>{t('auth.google.signupIntro', { email: signup.details.email })}</p>
              <p className="text-muted-foreground">
                {t('auth.google.otherAccountHint')}{' '}
                <Link className="text-primary hover:underline" to={ROUTES.LOGIN} onClick={closeSignup}>
                  {t('auth.google.otherAccountAction')}
                </Link>
              </p>
            </div>
          )
        }
      />
    </div>
  );
}
