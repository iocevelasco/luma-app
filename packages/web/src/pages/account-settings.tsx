import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangeEmail, useChangePassword } from '@/hooks/auth/use-auth-queries';
import { useAuth } from '@/providers/auth-provider';

export function AccountSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const changePassword = useChangePassword();
  const changeEmail = useChangeEmail();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">{t('auth.account.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('auth.account.changePassword')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
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

            <Button type="submit" disabled={changePassword.isPending}>
              {t('common.save')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('auth.account.changeEmail')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-4"
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

            <Button type="submit" disabled={changeEmail.isPending}>
              {t('common.save')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountSettingsPage;
