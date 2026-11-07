import { useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Lock,
  MailQuestion,
  UserCheck,
  Users,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  PLATFORM_FOLLOW_UP_FILTERS,
  PLATFORM_USERS_FILTERS,
  PLATFORM_USERS_SEGMENTS,
  type PlatformFollowUpFilter,
  type PlatformUsersFilter,
  type PlatformUsersSegment,
} from '@luma/shared';
import { EmptyState } from '@/components/common/empty-state';
import { RowCardList } from '@/components/common/row-card-list';
import { SearchField } from '@/components/common/search-field';
import { PageLayout } from '@/components/layout/page-layout';
import { AccountsCensus } from '@/components/platform/accounts-census';
import { AccountsFollowUp } from '@/components/platform/accounts-follow-up';
import { AccountsFunnel } from '@/components/platform/accounts-funnel';
import { UserRowCard } from '@/components/platform/user-row-card';
import { UsersOverview } from '@/components/platform/users-overview';
import { UsersViewTabs, type UsersView } from '@/components/platform/users-view-tabs';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDebouncedSearch } from '@/hooks/platform/use-debounced-search';
import {
  usePlatformCensus,
  usePlatformFollowUp,
  usePlatformFunnel,
  usePlatformUsers,
  usePlatformUsersOverview,
} from '@/hooks/platform/use-platform-users-queries';

const PAGE_SIZE = 20;

/** El ícono de cada subconjunto de cuentas de las pestañas del directorio. */
const FILTER_ICON: Record<PlatformUsersFilter, LucideIcon> = {
  all: Users,
  active: UserCheck,
  unverified: MailQuestion,
  inactive: UserX,
};

/** Y el de cada filtro del seguimiento. */
const FOLLOW_UP_ICON: Record<PlatformFollowUpFilter, LucideIcon> = {
  all: Users,
  risk: AlertTriangle,
  trial: Clock,
  paying: CircleDollarSign,
  expired: Lock,
};

/**
 * Las cuentas de Luma, para el admin de la plataforma. Cuatro vistas:
 *
 * - **Censo**: cuántas cuentas hay de cada tipo. Solo las que tienen membresía
 *   importan; clientes, empleados y cuentas de prueba se cuentan aparte.
 * - **Embudo**: dónde se caen las cuentas con membresía, por cohorte semanal.
 * - **Seguimiento**: una fila por cuenta con membresía y a quién escribirle.
 * - **Directorio**: el listado de todas las cuentas, con segmento y plan ilimitado.
 *
 * La ruta va detrás de `AdminLayout` y la API lo vuelve a exigir.
 */
export function PlatformUsersPage() {
  const [view, setView] = useState<UsersView>('census');

  switch (view) {
    case 'census':
      return <CensusView onView={setView} />;
    case 'funnel':
      return <FunnelView onView={setView} />;
    case 'followUp':
      return <FollowUpView onView={setView} />;
    case 'directory':
      return <DirectoryView onView={setView} />;
  }
}

interface ViewProps {
  onView: (view: UsersView) => void;
}

function CensusView({ onView }: ViewProps) {
  const census = usePlatformCensus(true);

  return (
    <PageLayout
      width="default"
      toolbar={<UsersViewTabs value="census" onChange={onView} />}
      isLoading={census.isLoading}
      isError={census.isError}
    >
      {census.data && <AccountsCensus census={census.data} />}
    </PageLayout>
  );
}

function FunnelView({ onView }: ViewProps) {
  const funnel = usePlatformFunnel(true);

  return (
    <PageLayout
      width="default"
      toolbar={<UsersViewTabs value="funnel" onChange={onView} />}
      isLoading={funnel.isLoading}
      isError={funnel.isError}
    >
      {funnel.data && <AccountsFunnel funnel={funnel.data} />}
    </PageLayout>
  );
}

function FollowUpView({ onView }: ViewProps) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<PlatformFollowUpFilter>('all');
  const [page, setPage] = useState(1);
  const { search, setSearch, q } = useDebouncedSearch(() => setPage(1));

  const followUp = usePlatformFollowUp({ filter, q, page, pageSize: PAGE_SIZE }, true);
  const data = followUp.data;

  const toolbar = (
    <>
      <UsersViewTabs value="followUp" onChange={onView} />
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as PlatformFollowUpFilter);
          setPage(1);
        }}
      >
        <TabsList>
          {PLATFORM_FOLLOW_UP_FILTERS.map((value) => (
            <TabsTrigger key={value} value={value} icon={FOLLOW_UP_ICON[value]}>
              {t(`platform.followUp.filters.${value}`)}
              {data && (
                <span className="font-mono text-xs tabular-nums opacity-70">
                  {data.counts[value].toLocaleString(i18n.language)}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <SearchField
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('platform.users.searchPlaceholder')}
        aria-label={t('platform.users.searchPlaceholder')}
        wrapperClassName="w-full sm:w-64"
      />
    </>
  );

  return (
    <PageLayout
      width="default"
      toolbar={toolbar}
      isLoading={followUp.isLoading}
      isError={followUp.isError}
    >
      {data && (
        <div className="flex flex-col gap-6">
          <AccountsFollowUp page={data} filtered={Boolean(q) || filter !== 'all'} />
          <PaginationNav
            page={data.page}
            pages={data.pages}
            total={data.total}
            locale={i18n.language}
            onPage={setPage}
          />
        </div>
      )}
    </PageLayout>
  );
}

function DirectoryView({ onView }: ViewProps) {
  const { t, i18n } = useTranslation();
  const [filter, setFilter] = useState<PlatformUsersFilter>('all');
  const [segment, setSegment] = useState<PlatformUsersSegment>('all');
  const [page, setPage] = useState(1);
  const { search, setSearch, q } = useDebouncedSearch(() => setPage(1));

  const overview = usePlatformUsersOverview();
  const users = usePlatformUsers({ filter, segment, q, page, pageSize: PAGE_SIZE });
  const data = users.data;

  const toolbar = (
    <>
      <UsersViewTabs value="directory" onChange={onView} />
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

        {data && (
          <PaginationNav
            page={data.page}
            pages={data.pages}
            total={data.total}
            locale={i18n.language}
            onPage={setPage}
          />
        )}
      </div>
    </PageLayout>
  );
}

/** Anterior / siguiente. No se dibuja con una sola página. */
function PaginationNav({
  page,
  pages,
  total,
  locale,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  locale: string;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  if (pages <= 1) return null;

  return (
    <nav
      aria-label={t('platform.users.pagination.label')}
      className="flex items-center justify-between gap-3"
    >
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <ChevronLeft className="size-4" />
        {t('platform.users.pagination.previous')}
      </Button>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('platform.users.pagination.status', {
          page,
          pages,
          total: total.toLocaleString(locale),
        })}
      </p>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        {t('platform.users.pagination.next')}
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}

export default PlatformUsersPage;
