import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PasswordFormProps {
  submitLabel: string;
  isPending: boolean;
  onSubmit: (password: string) => void;
}

/**
 * Elegir una contraseña con confirmación. Lo comparten el reset y la
 * activación: el flujo es el mismo, cambia sólo el endpoint que lo recibe.
 */
export function PasswordForm({ submitLabel, isPending, onSubmit }: PasswordFormProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (password !== confirm) {
          setError(t('auth.resetPassword.mismatch'));
          return;
        }
        setError(null);
        onSubmit(password);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t('auth.resetPassword.newPassword')}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">{t('auth.resetPassword.confirmPassword')}</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? t('common.loading') : submitLabel}
      </Button>
    </form>
  );
}
