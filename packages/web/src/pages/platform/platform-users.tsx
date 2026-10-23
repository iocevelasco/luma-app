import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PLATFORM_USERS_FILTERS, type PlatformUsersFilter } from '@luma/shared';
import { EmptyState } from '@/components/common/empty-state';
import { RowCardList } from '@/components/common/row-card-list';
import { PageLayout } from '@/components/layout/page-layout';
import { UserRowCard } from '@/components/platform/user-row-card';
import { UsersOverview } from '@/components/platform/users-overview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  usePlatformUsers,
  usePlatformUsersOverview,
} from '@/hooks/platform/use-platform-users-queries';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

/**
 * Las cuentas de Luma, para el admin de la plataforma: cuántas hay, cuántas
 * confirmaron el mail y quién se registró hace poco. Sólo lectura. La ruta va
 * detrás de `AdminLayout` y la API lo vuelve a exigir.
 */
export function PlatformUsersPage() {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<PlatformUsersFilter>('all');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  // La búsqueda espera a que la persona deje de escribir: una consulta por
  // letra es una consulta que nadie va a leer.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  const overview = usePlatformUsersOverview();
  const users = usePlatformUsers({ filter, q, page, pageSize: PAGE_SIZE });
  const data = users.data;

  const toolbar = (
    <>
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as PlatformUsersFilter);
          setPage(1);
        }}
      >
        <TabsList>
          {PLATFORM_USERS_FILTERS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`platform.users.filters.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="relative w-full sm:w-64">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('platform.users.searchPlaceholder')}
          aria-label={t('platform.users.searchPlaceholder')}
          className="pl-9"
        />
      </div>
    </>
  );

  return (
    <PageLayout
      width="default"
      toolbar={toolbar}
      isLoading={users.isLoading || overview.isLoading}
      isError={users.isError || overview.isError}
    >
      <div className="flex flex-col gap-6">
        {overview.data && <UsersOverview overview={overview.data} />}

        {data && data.users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t('platform.users.empty')}
            description={q || filter !== 'all' ? t('platform.users.emptyFiltered') : undefined}
          />
        ) : (
          <RowCardList>
            {data?.users.map((user) => (
              <UserRowCard key={user.id} user={user} />
            ))}
          </RowCardList>
        )}

        {data && data.pages > 1 && (
          <nav
            aria-label={t('platform.users.pagination.label')}
            className="flex items-center justify-between gap-3"
          >
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft className="size-4" />
              {t('platform.users.pagination.previous')}
            </Button>
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {t('platform.users.pagination.status', {
                page: data.page,
                pages: data.pages,
                total: data.total.toLocaleString(i18n.language),
              })}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pages}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('platform.users.pagination.next')}
              <ChevronRight className="size-4" />
            </Button>
          </nav>
        )}
      </div>
    </PageLayout>
  );
}

export default PlatformUsersPage;
