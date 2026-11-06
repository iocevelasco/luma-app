import { useEffect, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  MailQuestion,
  UserCheck,
  Users,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  PLATFORM_USERS_FILTERS,
  PLATFORM_USERS_SEGMENTS,
  type PlatformUsersFilter,
  type PlatformUsersSegment,
} from '@luma/shared';
import { EmptyState } from '@/components/common/empty-state';
import { RowCardList } from '@/components/common/row-card-list';
import { PageLayout } from '@/components/layout/page-layout';
import { AccountsCensus } from '@/components/platform/accounts-census';
import { UserRowCard } from '@/components/platform/user-row-card';
import { UsersOverview } from '@/components/platform/users-overview';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/common/search-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  usePlatformCensus,
  usePlatformUsers,
  usePlatformUsersOverview,
} from '@/hooks/platform/use-platform-users-queries';

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

/** Las dos vistas de la pantalla: el censo por segmento y el listado de cuentas. */
const VIEWS = ['census', 'directory'] as const;
type View = (typeof VIEWS)[number];

const VIEW_ICON: Record<View, LucideIcon> = {
  census: BarChart3,
  directory: Users,
};

/**
 * Las cuentas de Luma, para el admin de la plataforma. El **censo** dice cuántas
 * hay de cada tipo (solo las que tienen membresía importan) y el **directorio**
 * es el listado: confirmadas, altas recientes, segmento y el plan ilimitado. La
 * ruta va detrás de `AdminLayout` y la API lo vuelve a exigir.
 */
/** El ícono de cada subconjunto de cuentas de las pestañas. */
const FILTER_ICON: Record<PlatformUsersFilter, LucideIcon> = {
  all: Users,
  active: UserCheck,
  unverified: MailQuestion,
  inactive: UserX,
};

export function PlatformUsersPage() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>('census');
  const [filter, setFilter] = useState<PlatformUsersFilter>('all');
  const [segment, setSegment] = useState<PlatformUsersSegment>('all');
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

  const inDirectory = view === 'directory';
  const census = usePlatformCensus(!inDirectory);
  const overview = usePlatformUsersOverview();
  const users = usePlatformUsers({ filter, segment, q, page, pageSize: PAGE_SIZE }, inDirectory);
  const data = users.data;

  const toolbar = (
    <>
      <Tabs value={view} onValueChange={(value) => setView(value as View)}>
        <TabsList>
          {VIEWS.map((value) => (
            <TabsTrigger key={value} value={value} icon={VIEW_ICON[value]}>
              {t(`platform.users.views.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {inDirectory && (
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
                <TabsTrigger key={value} value={value} icon={FILTER_ICON[value]}>
                  {t(`platform.users.filters.${value}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select
            value={segment}
            onValueChange={(value) => {
              setSegment(value as PlatformUsersSegment);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label={t('platform.users.segment.label')} className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_USERS_SEGMENTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`platform.users.segment.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SearchField
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('platform.users.searchPlaceholder')}
            aria-label={t('platform.users.searchPlaceholder')}
            wrapperClassName="w-full sm:w-64"
          />
        </>
      )}
    </>
  );

  if (!inDirectory) {
    return (
      <PageLayout
        width="default"
        toolbar={toolbar}
        isLoading={census.isLoading}
        isError={census.isError}
      >
        {census.data && <AccountsCensus census={census.data} />}
      </PageLayout>
    );
  }

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
            description={
              q || filter !== 'all' || segment !== 'all'
                ? t('platform.users.emptyFiltered')
                : undefined
            }
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
