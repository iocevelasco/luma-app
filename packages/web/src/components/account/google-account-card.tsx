import type { AuthUser } from '@luma/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLinkGoogle, useUnlinkGoogle } from '@/hooks/auth/use-auth-queries';
import { usePublicConfig } from '@/hooks/public-config/use-public-config';
import { errorMessage } from '@/lib/error-message';

/**
 * Conectar y desconectar Google desde la cuenta (ADR-005 §1.12 y §1.13).
 *
 * Conectar pide la contraseña actual y después el botón de Google: la prueba
 * es la contraseña, no el correo, así que sirve también con otro correo en
 * Google. Desconectar pide la contraseña y se confirma en un diálogo; una
 * cuenta sin contraseña no puede, porque se quedaría sin forma de entrar.
 */
export function GoogleAccountCard({ user }: { user: AuthUser }) {
  const { t } = useTranslation();
  const { data: config } = usePublicConfig();
  const link = useLinkGoogle();
  const unlink = useUnlinkGoogle();

  const [linkPassword, setLinkPassword] = useState('');
  const [missingPassword, setMissingPassword] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [unlinkPassword, setUnlinkPassword] = useState('');

  const clientId = config?.googleLogin?.clientId;
  if (!user.google_linked && (!user.google_available || !clientId)) return null;

  const hasPassword = user.has_password !== false;

  const closeUnlink = () => {
    setConfirmUnlink(false);
    setUnlinkPassword('');
    unlink.reset();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('auth.google.cardTitle')}</CardTitle>
        <CardDescription>
          {user.google_linked ? t('auth.google.linkedBody') : t('auth.google.unlinkedBody')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {user.google_linked ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Badge variant="success">{t('auth.google.connected')}</Badge>
                <span className="truncate text-sm">{user.google_email}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!hasPassword}
                onClick={() => setConfirmUnlink(true)}
              >
                {t('auth.google.unlink')}
              </Button>
            </div>
            {!hasPassword && (
              <p className="text-xs text-muted-foreground">{t('auth.google.unlinkNeedsPassword')}</p>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="google-link-password">{t('auth.google.linkPassword')}</Label>
              <Input
                id="google-link-password"
                type="password"
                autoComplete="current-password"
                value={linkPassword}
                aria-invalid={missingPassword || undefined}
                onChange={(event) => {
                  setLinkPassword(event.target.value);
                  setMissingPassword(false);
                }}
              />
              <p className="text-xs text-muted-foreground">{t('auth.google.linkHint')}</p>
            </div>
            {clientId && (
              <div className="max-w-sm">
                <GoogleSignInButton
                  clientId={clientId}
                  text="continue_with"
                  disabled={link.isPending}
                  onCredential={(credential) => {
                    if (!linkPassword) {
                      setMissingPassword(true);
                      return;
                    }
                    link.mutate(
                      { credential, password: linkPassword },
                      { onSuccess: () => setLinkPassword('') },
                    );
                  }}
                />
              </div>
            )}
            {(missingPassword || link.isError) && (
              <p role="alert" className="text-sm text-destructive">
                {missingPassword ? t('auth.google.passwordFirst') : errorMessage(link.error, t)}
              </p>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={confirmUnlink} onOpenChange={(open) => !open && closeUnlink()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('auth.google.unlinkTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('auth.google.unlinkBody', { email: user.google_email ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              unlink.mutate({ password: unlinkPassword }, { onSuccess: closeUnlink });
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="google-unlink-password">{t('common.password')}</Label>
              <Input
                id="google-unlink-password"
                type="password"
                autoComplete="current-password"
                required
                value={unlinkPassword}
                onChange={(event) => setUnlinkPassword(event.target.value)}
              />
            </div>
            {unlink.isError && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(unlink.error, t)}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={unlink.isPending}>{t('common.cancel')}</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={!unlinkPassword || unlink.isPending}>
                {unlink.isPending ? t('common.loading') : t('auth.google.unlink')}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
