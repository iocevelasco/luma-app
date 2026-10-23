import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import type { PlatformUserRow } from '@luma/shared';
import { RowCard, RowCardBody, RowCardEnd } from '@/components/common/row-card-list';
import { Badge } from '@/components/ui/badge';
import { useDateLocale } from '@/hooks/use-date-locale';

/**
 * Una cuenta, como fila. Línea 1: quién es. Línea 2: mail, rol y desde cuándo
 * está. A la derecha, en columna fija, los dos estados: si confirmó el mail y
 * si la cuenta está activa o dada de baja.
 */
export function UserRowCard({ user }: { user: PlatformUserRow }) {
  const { t } = useTranslation();
  const locale = useDateLocale();

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
      </RowCardEnd>
    </RowCard>
  );
}
