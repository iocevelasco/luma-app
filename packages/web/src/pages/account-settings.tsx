import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarFeedCard } from '@/components/account/calendar-feed-card';
import { GoogleAccountCard } from '@/components/account/google-account-card';
import { FormShell } from '@/components/common/form-shell';
import { LanguageSelector } from '@/components/language-selector';
import { OrganizationProfile } from '@/components/organization/organization-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useChangeEmail,
  useChangePassword,
  useCurrentUser,
  useForgotPassword,
} from '@/hooks/auth/use-auth-queries';
import { useAuth } from '@/providers/auth-provider';

export function AccountSettingsPage() {
  const { t } = useTranslation();
  const { user: sessionUser } = useAuth();
  // La de `/me` está al día (contraseña, Google); la de la sesión puede ser de antes.
  const { data: me } = useCurrentUser();
  const user = me?.user ?? sessionUser;
  const changePassword = useChangePassword();
  const changeEmail = useChangeEmail();
  const createPassword = useForgotPassword();
  // Una cuenta que entra sólo con Google no tiene contraseña que cambiar.
  const hasPassword = user?.has_password !== false;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');

  return (
    <div className="flex w-full flex-col gap-4 p-3 md:p-4">
      {/* Nombre y contacto de la Empresa: se tocan una vez, no es una pantalla de uso diario. */}
      <OrganizationProfile />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('common.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <LanguageSelector variant="form" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('auth.account.changePassword')}</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasPassword ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">{t('auth.google.noPasswordBody')}</p>
              <Button
                type="button"
                variant="outline"
                disabled={createPassword.isPending || !user}
                onClick={() => user && createPassword.mutate(user.email)}
              >
                {t('auth.google.createPassword')}
              </Button>
            </div>
          ) : (
          <>
          {/*
            Formularios cortos: el pie pegajoso queda donde ya estaba el
            botón. Van igual por el shell para que el error, el "guardando" y
            el bloqueo mientras no hay cambios se comporten como en el resto
            de la app, y no cada pantalla a su manera.
          */}
          <FormShell
            variant="embedded"
            className="gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              changePassword.mutate(
                { currentPassword, newPassword },
                {
                  onSuccess: () => {
                    setCurrentPassword('');
                    setNewPassword('');
                  },
                },
              );
            }}
            isSubmitting={changePassword.isPending}
            isDirty={Boolean(currentPassword && newPassword)}
            error={changePassword.error}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-password">{t('auth.account.currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">{t('auth.account.newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>

          </FormShell>
          </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('auth.account.changeEmail')}</CardTitle>
          {!hasPassword && (
            <CardDescription>{t('auth.google.emailNeedsPassword')}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {hasPassword && (
          <FormShell
            variant="embedded"
            className="gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              changeEmail.mutate(
                { newEmail, password: emailPassword },
                {
                  onSuccess: () => {
                    setNewEmail('');
                    setEmailPassword('');
                  },
                },
              );
            }}
            isSubmitting={changeEmail.isPending}
            isDirty={Boolean(newEmail && emailPassword)}
            error={changeEmail.error}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="current-email">{t('common.email')}</Label>
              <Input id="current-email" value={user?.email ?? ''} disabled readOnly />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="new-email">{t('auth.account.newEmail')}</Label>
              <Input
                id="new-email"
                type="email"
                required
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email-password">{t('common.password')}</Label>
              <Input
                id="email-password"
                type="password"
                autoComplete="current-password"
                required
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
              />
            </div>

          </FormShell>
          )}
        </CardContent>
      </Card>

      {user && <GoogleAccountCard user={user} />}

      <CalendarFeedCard />
    </div>
  );
}

export default AccountSettingsPage;
