import { useState } from 'react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { PlatformUserRow } from '@luma/shared';
import { RowCard, RowCardBody, RowCardEnd } from '@/components/common/row-card-list';
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
import { useSetUnlimitedPlan } from '@/hooks/platform/use-platform-users-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { errorMessage } from '@/lib/error-message';

/**
 * Una cuenta, como fila. Línea 1: quién es. Línea 2: mail, rol y desde cuándo
 * está. A la derecha, si confirmó el mail, si la cuenta está activa y si
 * tiene el plan ilimitado. Ese plan sólo se asigna desde acá.
 */
export function UserRowCard({ user }: { user: PlatformUserRow }) {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const [open, setOpen] = useState(false);
  const setUnlimited = useSetUnlimitedPlan();
  const next = !user.unlimited;

  const confirm = () => {
    setUnlimited.mutate(
      { userId: user.id, unlimited: next },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success(t(next ? 'platform.users.unlimitedGranted' : 'platform.users.unlimitedRevoked'));
        },
        onError: (error) => {
          toast.error(errorMessage(error, t) ?? t('platform.users.unlimitedError'));
        },
      },
    );
  };

  return (
    <RowCard>
      <RowCardBody
        title={<span className="truncate">{user.name}</span>}
        meta={
          <span className="block truncate">
            {[
              user.email,
              t(`platform.users.role.${user.role}`),
              t('platform.users.joined', { date: format(new Date(user.createdAt), 'PP', { locale }) }),
            ].join(' · ')}
          </span>
        }
      />
      <RowCardEnd>
        <Badge variant={user.emailVerified ? 'success' : 'warning'}>
          {t(user.emailVerified ? 'platform.users.verified' : 'platform.users.unverified')}
        </Badge>
        <Badge variant={user.accountStatus === 'active' ? 'neutral' : 'danger'}>
          {t(`platform.users.status.${user.accountStatus}`)}
        </Badge>
        {user.unlimited && <Badge variant="success">{t('platform.users.unlimited')}</Badge>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          {t(user.unlimited ? 'platform.users.revokeUnlimited' : 'platform.users.grantUnlimited')}
        </Button>
      </RowCardEnd>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(next ? 'platform.users.grantTitle' : 'platform.users.revokeTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(next ? 'platform.users.grantBody' : 'platform.users.revokeBody', { name: user.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setUnlimited.isPending}>
              {t('platform.users.cancel')}
            </AlertDialogCancel>
            <Button type="button" onClick={confirm} disabled={setUnlimited.isPending}>
              {t('platform.users.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RowCard>
  );
}
