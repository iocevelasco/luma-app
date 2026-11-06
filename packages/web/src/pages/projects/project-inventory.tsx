import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowRightLeft,
  ClipboardList,
  Download,
  MoreHorizontal,
  PackageMinus,
  Upload,
  Warehouse,
} from 'lucide-react';
import {
  stockDirection,
  PROJECT_STOCK_MOVEMENT_KINDS,
  type ManualStockMovementKind,
  type StockItem,
  type StockMovement,
  type ProjectStockMovementKind,
  type StockMovementQuery,
} from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { SearchField } from '@/components/common/search-field';
import { RowCard, RowCardBody, RowCardEnd, RowCardList } from '@/components/common/row-card-list';
import { MovementKindBadge, StockLevelBadge } from '@/components/inventory/inventory-badges';
import {
  StockMovementDrawer,
  type StockMovementDrawerInitial,
} from '@/components/inventory/stock-movement-drawer';
import { ImportFromDepositDrawer } from '@/components/inventory/import-from-deposit-drawer';
import { SendToDepositDrawer } from '@/components/inventory/send-to-deposit-drawer';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useMountOnOpen } from '@/hooks/use-mount-on-open';
import { useStock, useStockMovements } from '@/hooks/inventory/use-inventory-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useProject } from '@/hooks/projects/use-project-queries';

const ALL = '__all__';
/** Inventario de la obra: lo que hay en el patio y el kardex de cada movimiento. */
export function ProjectInventoryPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { can } = useProjectCapabilities(projectId);
  // La pestaña va en la URL (`?tab=kardex`): se puede compartir y sobrevive al recargar.
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'kardex' ? 'kardex' : 'stock';
  const [drawer, setDrawer] = useState<StockMovementDrawerInitial | null>(null);
  const [sendItem, setSendItem] = useState<StockItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { data: projectData } = useProject(projectId);
  // Los formularios piden actividades y Compras: se montan al abrirlos la primera vez,
  // no para cada persona que sólo mira el patio.
  const movementMounted = useMountOnOpen(drawer !== null);
  const sendMounted = useMountOnOpen(sendItem !== null);
  const importMounted = useMountOnOpen(importOpen);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<StockMovementQuery>({});

  const stockQuery = useStock(projectId);
  const movementsQuery = useStockMovements(projectId, filters);

  const items = useMemo(() => stockQuery.data?.items ?? [], [stockQuery.data]);
  const visibleItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((item) => item.name.toLowerCase().includes(term)) : items;
  }, [items, search]);

  if (stockQuery.isError) return <PageLayout isError />;
  if (stockQuery.isLoading || !stockQuery.data) return <PageLayout isLoading />;

  const canWrite = can('inventory.write');
  const canUseDeposit = can('inventory.deposit.write');
  const currency = projectData?.project.currency ?? '';
  const setFilter = (patch: Partial<StockMovementQuery>) =>
    setFilters((current) => ({ ...current, ...patch }));

  return (
    <>
      <PageLayout
        width="default"
        secondaryActions={
          canUseDeposit ? (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Download className="size-4" />
              {t('inventory.deposit.import')}
            </Button>
          ) : undefined
        }
        action={
          canWrite && items.length > 0 ? (
            <Button onClick={() => setDrawer({ kind: 'consumo' })}>
              <PackageMinus className="size-4" />
              {t('inventory.movement.new')}
            </Button>
          ) : undefined
        }
        toolbar={
          <div className="flex w-full flex-col gap-3">
            <Tabs
              value={tab}
              onValueChange={(value) =>
                setSearchParams(value === 'kardex' ? { tab: 'kardex' } : {}, { replace: true })
              }
            >
              <TabsList>
                <TabsTrigger value="stock" icon={Warehouse}>
                  {t('inventory.tabs.stock')}
                </TabsTrigger>
                <TabsTrigger value="kardex" icon={ClipboardList}>
                  {t('inventory.tabs.kardex')}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {items.length > 0 &&
              (tab === 'stock' ? (
                <SearchField
                  wrapperClassName="max-w-sm"
                  placeholder={t('inventory.stock.search')}
                  aria-label={t('inventory.stock.search')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              ) : (
                <KardexFilters items={items} filters={filters} onChange={setFilter} />
              ))}
          </div>
        }
        empty={
          items.length === 0
            ? {
                icon: Warehouse,
                title: t('inventory.empty.title'),
                description: t('inventory.empty.description'),
              }
            : undefined
        }
      >
        {tab === 'stock' ? (
          <div className="flex w-full flex-col gap-4">
            {visibleItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('inventory.stock.noResults')}</p>
            ) : (
              <RowCardList>
                {visibleItems.map((item) => (
                  <StockRow
                    key={item.itemKey}
                    item={item}
                    canWrite={canWrite}
                    canUseDeposit={canUseDeposit}
                    onRegister={(kind) => setDrawer({ kind, itemKey: item.itemKey })}
                    onSendToDeposit={() => setSendItem(item)}
                  />
                ))}
              </RowCardList>
            )}
          </div>
        ) : (
          <div className="flex w-full flex-col gap-4">
            {movementsQuery.isError ? (
              <p className="text-sm text-destructive">{t('inventory.kardex.error')}</p>
            ) : (movementsQuery.data?.movements ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('inventory.kardex.empty')}</p>
            ) : (
              <RowCardList>
                {movementsQuery.data!.movements.map((movement) => (
                  <MovementRow key={movement.id} movement={movement} />
                ))}
              </RowCardList>
            )}
          </div>
        )}
      </PageLayout>

      {/* Fuera de `PageLayout`: con el inventario vacío no se monta y el atajo no haría nada. */}
      {movementMounted && (
        <StockMovementDrawer
          projectId={projectId!}
          items={items}
          initial={drawer}
          open={drawer !== null}
          onOpenChange={(open) => {
            if (!open) setDrawer(null);
          }}
        />
      )}
      {sendMounted && (
        <SendToDepositDrawer
          projectId={projectId!}
          currency={currency}
          // Sin la moneda de la obra el costo de referencia no tendría unidad.
          item={currency ? sendItem : null}
          onOpenChange={(open) => {
            if (!open) setSendItem(null);
          }}
        />
      )}
      {importMounted && (
        <ImportFromDepositDrawer
          projectId={projectId!}
          currency={currency}
          canChargeFreight={can('expense.write')}
          open={importOpen && Boolean(currency)}
          onOpenChange={setImportOpen}
        />
      )}
    </>
  );
}

function StockRow({
  item,
  canWrite,
  canUseDeposit,
  onRegister,
  onSendToDeposit,
}: {
  item: StockItem;
  canWrite: boolean;
  canUseDeposit: boolean;
  onRegister: (kind: ManualStockMovementKind) => void;
  onSendToDeposit: () => void;
}) {
  const { t } = useTranslation();
  const unit = t(`material.unit.${item.unit}`);

  return (
    <RowCard>
      <RowCardBody
        title={<span className="truncate">{item.name}</span>}
        meta={[
          t('inventory.stock.meta', {
            received: item.received,
            consumed: item.consumed,
            wasted: item.wasted,
          }),
          item.transferred > 0 && t('inventory.stock.transferred', { quantity: item.transferred }),
        ]
          .filter(Boolean)
          .join(' · ')}
      />
      <RowCardEnd>
        {/* Qué hay, a la izquierda; las acciones, juntas a la derecha. En celular las acciones bajan como grupo. */}
        <div className="mr-auto flex items-center gap-2">
          <StockLevelBadge level={item.level} />
          <p className="text-lg tabular-nums">
            {item.stock} <span className="text-xs text-muted-foreground">{unit}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sin stock no hay qué entregar ni perder: no se ofrece. */}
          {canWrite && item.stock > 0 && (
            <Button variant="outline" size="sm" onClick={() => onRegister('consumo')}>
              <PackageMinus className="size-4" />
              {t('inventory.stock.deliver')}
            </Button>
          )}
          {(canWrite || (canUseDeposit && item.stock > 0)) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t('inventory.stock.moreActions', { name: item.name })}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canWrite && (
                  <DropdownMenuItem className="max-sm:min-h-11" onSelect={() => onRegister('devolucion')}>
                    <ArrowRightLeft className="size-4" />
                    {t('inventory.kind.devolucion')}
                  </DropdownMenuItem>
                )}
                {canWrite && item.stock > 0 && (
                  <DropdownMenuItem className="max-sm:min-h-11" onSelect={() => onRegister('merma')}>
                    {t('inventory.kind.merma')}
                  </DropdownMenuItem>
                )}
                {canUseDeposit && item.stock > 0 && (
                  <DropdownMenuItem className="max-sm:min-h-11" onSelect={onSendToDeposit}>
                    <Upload className="size-4" />
                    {t('inventory.deposit.send')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </RowCardEnd>
    </RowCard>
  );
}

function MovementRow({ movement }: { movement: StockMovement }) {
  const { t } = useTranslation();
  const locale = useDateLocale();
  const sign = stockDirection(movement.kind) === 'in' ? '+' : '−';
  const unit = t(`material.unit.${movement.unit}`);

  // Orden fijo de la línea 2: cuándo · quién · adónde · por qué · quién lo cargó.
  const meta = [
    format(new Date(movement.occurredAt), 'dd MMM yyyy HH:mm', { locale }),
    movement.receiver,
    [movement.activityName, movement.destination].filter(Boolean).join(' / ') || undefined,
    movement.reason,
    movement.createdByName ? t('inventory.kardex.by', { name: movement.createdByName }) : undefined,
  ].filter(Boolean);

  return (
    <RowCard>
      <RowCardBody title={<span className="truncate">{movement.name}</span>} meta={meta.join(' · ')} />
      <RowCardEnd>
        <MovementKindBadge kind={movement.kind} />
        <p className="tabular-nums">
          {sign}
          {movement.quantity} <span className="text-xs text-muted-foreground">{unit}</span>
        </p>
      </RowCardEnd>
    </RowCard>
  );
}

function KardexFilters({
  items,
  filters,
  onChange,
}: {
  items: StockItem[];
  filters: StockMovementQuery;
  onChange: (patch: Partial<StockMovementQuery>) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Input
        type="date"
        aria-label={t('inventory.kardex.from')}
        value={filters.from ?? ''}
        onChange={(event) => onChange({ from: event.target.value || undefined })}
      />
      <Input
        type="date"
        aria-label={t('inventory.kardex.to')}
        value={filters.to ?? ''}
        onChange={(event) => onChange({ to: event.target.value || undefined })}
      />
      <Select
        value={filters.itemKey ?? ALL}
        onValueChange={(value) => onChange({ itemKey: value === ALL ? undefined : value })}
      >
        <SelectTrigger aria-label={t('inventory.kardex.item')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('inventory.kardex.allItems')}</SelectItem>
          {items.map((item) => (
            <SelectItem key={item.itemKey} value={item.itemKey}>
              {item.name} · {t(`material.unit.${item.unit}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={filters.kind ?? ALL}
        onValueChange={(value) =>
          onChange({ kind: value === ALL ? undefined : (value as ProjectStockMovementKind) })
        }
      >
        <SelectTrigger aria-label={t('inventory.kardex.kind')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{t('inventory.kardex.allKinds')}</SelectItem>
          {PROJECT_STOCK_MOVEMENT_KINDS.map((kind) => (
            <SelectItem key={kind} value={kind}>
              {t(`inventory.kind.${kind}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SearchField
        placeholder={t('inventory.kardex.receiver')}
        aria-label={t('inventory.kardex.receiver')}
        value={filters.receiver ?? ''}
        onChange={(event) => onChange({ receiver: event.target.value || undefined })}
      />
    </div>
  );
}

export default ProjectInventoryPage;
