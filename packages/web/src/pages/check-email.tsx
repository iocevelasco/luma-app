import { useState, type FormEvent } from 'react';
import { emailSchema } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { useLocation, useSearchParams } from 'react-router-dom';
import { AuthHeader, AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useResendVerification } from '@/hooks/auth/use-auth-queries';

/**
 * "Revisá tu correo" y, si no llegó, pedir otro.
 *
 * El correo llega por el estado del router cuando la persona viene del
 * registro (no va en la URL). Desde "Me invitaron" del login no hay ninguno:
 * antes el botón de reenviar no aparecía y esta pantalla era un callejón; ahora
 * se pide acá. El servidor contesta igual exista o no la cuenta, así que esto
 * no enumera direcciones.
 */
export function CheckEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const stateEmail = (location.state as { email?: unknown } | null)?.email;
  const knownEmail =
    searchParams.get('email') ?? (typeof stateEmail === 'string' ? stateEmail : null);
  const resend = useResendVerification();
  const [typed, setTyped] = useState('');

  const parsed = emailSchema.safeParse(typed);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (parsed.success) resend.mutate(parsed.data);
  }

  return (
    <AuthSplitLayout width="md">
      <AuthHeader title={t('auth.checkEmail.title')} description={t('auth.checkEmail.subtitle')} />
      {knownEmail ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={resend.isPending}
            onClick={() => resend.mutate(knownEmail)}
          >
            {resend.isPending ? t('common.loading') : t('auth.checkEmail.resend')}
          </Button>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <p className="text-sm text-muted-foreground">{t('auth.checkEmail.askEmail')}</p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resend-email">{t('common.email')}</Label>
            <Input
              id="resend-email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!parsed.success || resend.isPending}>
            {resend.isPending ? t('common.loading') : t('auth.checkEmail.resend')}
          </Button>
        </form>
      )}
    </AuthSplitLayout>
  );
}

export default CheckEmailPage;
