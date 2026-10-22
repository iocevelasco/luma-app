import { useEffect, useMemo, useRef, useState } from 'react';
import { type MaterialItem, type MaterialStatus } from '@luma/shared';
import { differenceInCalendarDays, format } from 'date-fns';
import { Copy, FileDown, MoreHorizontal, Package, Pencil, Plus, Share2, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fromDayKey } from '@/components/common/date-range-filter';
import { MaterialDrawer } from '@/components/materials/material-drawer';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import { PageLayout } from '@/components/layout/page-layout';
import { Badge } from '@/components/ui/badge';
import { TriStateCheckbox } from '@/components/common/tri-state-checkbox';
import { Spinner } from '@/components/ui/spinner';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useBulkDeleteMaterials,
  useBulkUpdateMaterials,
  useDeleteMaterial,
  useMaterials,
  useUpdateMaterial,
} from '@/hooks/materials/use-material-queries';
import { useProject } from '@/hooks/projects/use-project-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import {
  NEXT_MATERIAL_STATUS,
  buildPurchaseRows,
  buildPurchaseText,
  bulkActionsFor,
  countSuppliers,
  materialTab,
  organizeMaterials,
  selectionState,
  type PurchaseRow,
} from '@/lib/materials';
import { cn } from '@/lib/utils';

const MATERIAL_STATUSES: MaterialStatus[] = ['pendiente', 'solicitado', 'comprado', 'en_obra'];

/** Faltan hasta tantos días para que una actividad empiece y se marca como urgente. */
const URGENT_WITHIN_DAYS = 7;

function copyText(text: string) {
  if (typeof navigator.clipboard === 'object' && typeof navigator.clipboard.writeText === 'function') {
    return navigator.clipboard.writeText(text);
  }
  // Fallback: Safari viejo / contexto sin permisos de clipboard.
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
  return Promise.resolve();
}

/**
 * El alta vive en el drawer lateral, no en la cabecera de la página: como
 * formulario fijo se comía media pantalla y empujaba la lista —que es lo que
 * se viene a leer— abajo del pliegue. Se entra muchas más veces a mirar la
 * lista que a cargar un material.
 */
function NewMaterialButton({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('material.list.newTitle')}
      </Button>
      <MaterialDrawer projectId={projectId} open={open} onOpenChange={setOpen} />
    </>
  );
}

/**
 * La casilla de selección. El `label` agranda el área tocable a 44px en el
 * celular sin agrandar el cuadrado: la fila entera NO selecciona, porque con
 * guantes un toque al pasar la activaría por error.
 */
function SelectCheckbox({
  state,
  label,
  onChange,
}: {
  state: boolean | 'indeterminate';
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="-ml-2 flex size-8 shrink-0 items-center justify-center max-sm:size-11">
      <TriStateCheckbox
        checked={state}
        aria-label={label}
        // Desde "algunos", el toque completa la selección: es lo que hace Gmail.
        onCheckedChange={(checked) => onChange(checked === true || state === 'indeterminate')}
        className="max-sm:size-5"
      />
    </span>
  );
}

/** La casilla de un grupo —o de la pestaña entera— sobre sus materiales. */
function GroupCheckbox({
  ids,
  selected,
  label,
  onSetMany,
}: {
  ids: string[];
  selected: ReadonlySet<string>;
  label: string;
  onSetMany: (ids: string[], checked: boolean) => void;
}) {
  const state = selectionState(ids, selected);
  return (
    <SelectCheckbox
      state={state === 'all' ? true : state === 'some' ? 'indeterminate' : false}
      label={label}
      onChange={(checked) => onSetMany(ids, checked)}
    />
  );
}

/** Lo que una fila necesita para ofrecer su casilla. Sin esto, no la muestra. */
interface RowSelection {
  selected: ReadonlySet<string>;
  onSetMany: (ids: string[], checked: boolean) => void;
}

function MaterialRow({
  material,
  projectId,
  canEdit,
  activityName,
  highlighted = false,
  selection,
  onEdit,
  onDelete,
}: {
  material: MaterialItem;
  selection?: RowSelection;
  projectId: string;
  canEdit: boolean;
  /** Los diálogos viven en la página: una lista larga no monta uno por fila. */
  onEdit: (material: MaterialItem) => void;
  onDelete: (material: MaterialItem) => void;
  /** Sólo donde la fila no está bajo el encabezado de su actividad. */
  activityName?: string;
  /** El material al que se llegó con `?material=` desde el resumen de la obra. */
  highlighted?: boolean;
}) {
  const { t } = useTranslation();
  const updateMaterial = useUpdateMaterial(projectId);
  const [pendingStatus, setPendingStatus] = useState<MaterialStatus | null>(null);
  const next = NEXT_MATERIAL_STATUS[material.status];
  const rowRef = useRef<HTMLLIElement>(null);

  // Sin el scroll, la fila puede quedar abajo del pliegue y el click en el
  // resumen parece no haber hecho nada.
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [highlighted]);

  return (
    <li
      ref={rowRef}
      aria-current={highlighted || undefined}
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 py-3 text-sm',
        highlighted && '-mx-2 rounded-md bg-primary/10 px-2',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {selection && (
          <SelectCheckbox
            state={selection.selected.has(material.id)}
            label={t('material.bulk.select', { name: material.name })}
            onChange={(checked) => selection.onSetMany([material.id], checked)}
          />
        )}
        <div className="min-w-0">
          <p className="font-medium">{material.name}</p>
          <p className="text-muted-foreground">
            {material.quantity} {t(`material.unit.${material.unit}`)}
            {material.supplier ? ` · ${material.supplier}` : ''}
            {activityName ? ` · ${activityName}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <MaterialStatusBadge status={material.status} />

        {canEdit && next && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-sm:min-h-11"
            onClick={() => setPendingStatus(next)}
          >
            {t(`material.action.${next}`)}
          </Button>
        )}

        {/*
          Sólo se ofrece lo que se puede hacer: un lápiz gris en un celular no
          explica nada, y no hay tooltip. Por qué no está lo dice la nota del
          menú, y el diálogo de cambio de estado avisa antes de bloquearlo.
        */}
        {canEdit && material.editable && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="max-sm:size-11"
            aria-label={t('material.list.edit', { name: material.name })}
            onClick={() => onEdit(material)}
          >
            <Pencil className="size-4" />
          </Button>
        )}

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="max-sm:size-11"
                aria-label={t('material.list.moreActions', { name: material.name })}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MATERIAL_STATUSES.filter((status) => status !== material.status).map((status) => (
                <DropdownMenuItem
                  key={status}
                  className="max-sm:min-h-11"
                  onSelect={() => setPendingStatus(status)}
                >
                  {t(`material.status.${status}`)}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              {material.editable ? (
                <>
                  <DropdownMenuItem className="max-sm:min-h-11" onSelect={() => onEdit(material)}>
                    <Pencil className="size-4" />
                    {t('material.list.editLabel')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    className="max-sm:min-h-11"
                    onSelect={() => onDelete(material)}
                  >
                    <Trash2 className="size-4" />
                    {t('material.list.delete')}
                  </DropdownMenuItem>
                </>
              ) : (
                // Texto, no un ítem deshabilitado: se lee tocando el menú.
                <DropdownMenuLabel className="max-w-56 whitespace-normal font-normal text-muted-foreground">
                  {t('material.list.lockedNote')}
                </DropdownMenuLabel>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <AlertDialog open={pendingStatus !== null} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('material.list.confirmStatusTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('material.list.confirmStatusBody', {
                status: pendingStatus ? t(`material.status.${pendingStatus}`) : '',
              })}
              {/* Que el bloqueo no sea una sorpresa: se avisa antes de salir de Pendiente. */}
              {material.editable && ` ${t('material.list.confirmStatusLockWarning')}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingStatus) {
                  updateMaterial.mutate({
                    materialId: material.id,
                    payload: { status: pendingStatus },
                  });
                }
                setPendingStatus(null);
              }}
            >
              {t('common.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** Los materiales que necesita una misma actividad, con cuándo empieza. */
function ToBuyGroup({
  name,
  startDate,
  materials,
  projectId,
  canEdit,
  highlightedId,
  selection,
  onEdit,
  onDelete,
}: {
  /** `null` = materiales sin actividad. */
  name: string | null;
  startDate?: string;
  materials: MaterialItem[];
  projectId: string;
  canEdit: boolean;
  highlightedId: string | null;
  selection?: RowSelection;
  onEdit: (material: MaterialItem) => void;
  onDelete: (material: MaterialItem) => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const groupName = name ?? t('material.list.withoutActivity');

  const days = startDate ? differenceInCalendarDays(fromDayKey(startDate), new Date()) : null;
  const urgent = days !== null && days <= URGENT_WITHIN_DAYS;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex min-w-0 items-center gap-2">
          {selection && (
            <GroupCheckbox
              ids={materials.map((material) => material.id)}
              selected={selection.selected}
              label={t('material.bulk.selectGroup', { name: groupName })}
              onSetMany={selection.onSetMany}
            />
          )}
          <p className="text-sm font-medium">{groupName}</p>
        </div>
        {startDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t('material.list.startsOn', {
                date: format(fromDayKey(startDate), 'PP', { locale: dateLocale }),
              })}
            </span>
            {urgent && (
              <Badge variant={days! < 0 ? 'danger' : 'warning'} icon>
                {days! < 0
                  ? t('material.list.startedAlready')
                  : days === 0
                    ? t('material.list.startsToday')
                    : t('material.list.startsInDays', { count: days! })}
              </Badge>
            )}
          </div>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {materials.map((material) => (
          <MaterialRow
            key={material.id}
            material={material}
            projectId={projectId}
            canEdit={canEdit}
            highlighted={material.id === highlightedId}
            selection={selection}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </div>
  );
}

/** Un tramo de "Comprados" (en camino, en obra), con su casilla de grupo. */
function BoughtGroup({
  title,
  materials,
  projectId,
  canEdit,
  highlightedId,
  activityById,
  selection,
  onEdit,
  onDelete,
}: {
  title: string;
  materials: MaterialItem[];
  projectId: string;
  canEdit: boolean;
  highlightedId: string | null;
  activityById: ReadonlyMap<string, { name: string }>;
  selection?: RowSelection;
  onEdit: (material: MaterialItem) => void;
  onDelete: (material: MaterialItem) => void;
}) {
  const { t } = useTranslation();
  if (materials.length === 0) return null;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        {selection && (
          <GroupCheckbox
            ids={materials.map((material) => material.id)}
            selected={selection.selected}
            label={t('material.bulk.selectGroup', { name: title })}
            onSetMany={selection.onSetMany}
          />
        )}
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title} ({materials.length})
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {materials.map((material) => (
          <MaterialRow
            key={material.id}
            material={material}
            projectId={projectId}
            canEdit={canEdit}
            highlighted={material.id === highlightedId}
            selection={selection}
            onEdit={onEdit}
            onDelete={onDelete}
            activityName={material.activityId ? activityById.get(material.activityId)?.name : undefined}
          />
        ))}
      </ul>
    </div>
  );
}

/** Lo que la barra de selección pide confirmar antes de mandar. */
type PendingBulk = { kind: 'status'; status: MaterialStatus } | { kind: 'delete' };

/**
 * La barra que reemplaza a "Descargar PDF / Copiar / Compartir" mientras hay
 * algo tildado. En el celular se despega y queda fija abajo, donde llega el
 * pulgar; en escritorio queda arriba de la lista, como en Gmail.
 *
 * Ofrece sólo lo que vale para todo lo seleccionado (`bulkActionsFor`).
 */
function SelectionBar({
  selected,
  exportable,
  canShare,
  generatingPdf,
  onAction,
  onDownloadPdf,
  onCopy,
  onShare,
  onClear,
}: {
  selected: MaterialItem[];
  /** Copiar, compartir y PDF arman la lista de compras: sólo en "Por comprar". */
  exportable: boolean;
  canShare: boolean;
  generatingPdf: boolean;
  onAction: (action: PendingBulk) => void;
  onDownloadPdf: () => void;
  onCopy: () => void;
  onShare: () => void;
  onClear: () => void;
}) {
  const { t } = useTranslation();
  const { next, canDelete } = bulkActionsFor(selected);
  const current = selected.every((material) => material.status === selected[0]?.status)
    ? selected[0]?.status
    : undefined;

  return (
    <div
      role="toolbar"
      aria-label={t('material.bulk.toolbar')}
      className="flex flex-wrap items-center gap-2 max-sm:fixed max-sm:justify-end max-sm:inset-x-4 max-sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] max-sm:z-30 max-sm:rounded-lg max-sm:border max-sm:border-border max-sm:bg-card max-sm:p-3 max-sm:shadow-lg"
    >
      {/*
        En el celular, contador y cerrar van en una fila y las acciones abajo:
        en 375px no entran juntos. En escritorio el grupo se disuelve
        (`contents`) y la X vuelve al final.
      */}
      <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between sm:contents">
        <p aria-live="polite" className="text-sm font-medium sm:mr-auto">
          {t('material.bulk.selected', { count: selected.length })}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="max-sm:size-11 sm:order-last"
          aria-label={t('material.bulk.clear')}
          onClick={onClear}
        >
          <X className="size-4" />
        </Button>
      </div>

      {next && (
        <Button
          type="button"
          size="sm"
          className="max-sm:min-h-11"
          onClick={() => onAction({ kind: 'status', status: next })}
        >
          {t(`material.action.${next}`)}
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="max-sm:size-11"
            aria-label={t('material.bulk.moreActions')}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {t('material.list.changeStatus')}
          </DropdownMenuLabel>
          {MATERIAL_STATUSES.filter((status) => status !== current).map((status) => (
            <DropdownMenuItem
              key={status}
              className="max-sm:min-h-11"
              onSelect={() => onAction({ kind: 'status', status })}
            >
              {t(`material.status.${status}`)}
            </DropdownMenuItem>
          ))}

          {exportable && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="max-sm:min-h-11" disabled={generatingPdf} onSelect={onDownloadPdf}>
                <FileDown className="size-4" />
                {t('material.list.downloadPdf')}
              </DropdownMenuItem>
              <DropdownMenuItem className="max-sm:min-h-11" onSelect={onCopy}>
                <Copy className="size-4" />
                {t('material.list.copyList')}
              </DropdownMenuItem>
              {canShare && (
                <DropdownMenuItem className="max-sm:min-h-11" onSelect={onShare}>
                  <Share2 className="size-4" />
                  {t('material.list.share')}
                </DropdownMenuItem>
              )}
            </>
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                className="max-sm:min-h-11"
                onSelect={() => onAction({ kind: 'delete' })}
              >
                <Trash2 className="size-4" />
                {t('material.list.delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/**
 * Compras de la obra: lo que falta comprar y lo que ya se compró.
 *
 * Son las dos preguntas de quien maneja la obra, y los cuatro estados del
 * material (pendiente, solicitado, comprado, en obra) son el camino entre una
 * y la otra. Lo que falta se ordena por cuándo lo necesita cada actividad, no
 * por estado: lo que frena el lunes va arriba aunque se haya cargado último.
 * Lo comprado separa lo que todavía no llegó de lo que ya está en obra, que es
 * lo que se pregunta quien está en el sitio.
 *
 * Van en dos pestañas y no una lista abajo de la otra: con una lista de compras
 * larga, lo comprado quedaba abajo del pliegue y había que scrollear para saber
 * si existía. Las pestañas muestran los dos conteos de entrada. "Por comprar"
 * abre por defecto: es la que pide acción.
 *
 * La selección múltiple es de una pestaña a la vez: cambiar de pestaña la
 * limpia. Así "seleccionar todos" nunca toca algo que no se está viendo.
 */
export function ProjectMaterialsPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: materialsData, isLoading, isError } = useMaterials(projectId);
  const { data: projectData } = useProject(projectId);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const { data: activitiesData } = useAllActivities(projectId);
  const deleteMaterial = useDeleteMaterial(projectId!);
  const bulkUpdate = useBulkUpdateMaterials(projectId!);
  const bulkDelete = useBulkDeleteMaterials(projectId!);

  // Un solo drawer y un solo diálogo de borrado para toda la lista.
  const [editing, setEditing] = useState<MaterialItem | null>(null);
  const [deleting, setDeleting] = useState<MaterialItem | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingBulk, setPendingBulk] = useState<PendingBulk | null>(null);

  // Gerente y supervisor gestionan las compras; lo decide la grilla.
  const canWrite = useProjectCapabilities(projectId).can('material.write');

  const activityById = useMemo(() => {
    const map = new Map<string, { name: string; startDate: string }>();
    for (const activity of activitiesData?.activities ?? []) {
      map.set(activity.id, { name: activity.name, startDate: activity.startDate });
    }
    return map;
  }, [activitiesData]);

  const { toBuy, toBuyGroups, onTheWay, onSite, bought } = useMemo(
    () => organizeMaterials(materialsData?.materials ?? [], activityById),
    [materialsData, activityById],
  );

  // El resumen de la obra enlaza a un material puntual con `?material=<id>`.
  const [searchParams] = useSearchParams();
  const highlightedId = searchParams.get('material');

  // La misma lista para copiar, compartir y el PDF: agrupada por proveedor.
  const purchaseRows = useMemo(() => buildPurchaseRows(toBuy, i18n.language), [toBuy, i18n.language]);

  // Lo seleccionado se lee contra la lista actual: un material que otra
  // persona borró o pasó de pestaña deja de contar solo, sin limpiar nada.
  const selectedToBuy = useMemo(() => toBuy.filter((m) => selected.has(m.id)), [toBuy, selected]);
  const selectedBought = useMemo(() => bought.filter((m) => selected.has(m.id)), [bought, selected]);
  const selectedRows = useMemo(
    () => buildPurchaseRows(selectedToBuy, i18n.language),
    [selectedToBuy, i18n.language],
  );
  const hasSelection = selectedToBuy.length + selectedBought.length > 0;

  function setMany(ids: string[], checked: boolean) {
    setSelected((previous) => {
      const nextSelected = new Set(previous);
      for (const id of ids) {
        if (checked) nextSelected.add(id);
        else nextSelected.delete(id);
      }
      return nextSelected;
    });
  }

  const clearSelection = () => setSelected(new Set());
  const selection: RowSelection | undefined = canWrite ? { selected, onSetMany: setMany } : undefined;

  function confirmBulk(materials: MaterialItem[]) {
    if (!pendingBulk) return;
    const ids = materials.map((material) => material.id);
    const options = { onSuccess: clearSelection };
    if (pendingBulk.kind === 'delete') bulkDelete.mutate({ ids }, options);
    else bulkUpdate.mutate({ ids, status: pendingBulk.status }, options);
    setPendingBulk(null);
  }

  // El PDF y su librería pesan: se bajan apenas hay algo que descargar, no al
  // tocar el botón. En Safari, descargar o compartir tiene que ocurrir dentro
  // del gesto, y esperar un chunk grande lo deja afuera.
  const hasToBuy = toBuy.length > 0;
  useEffect(() => {
    if (!hasToBuy) return;
    void import('@/lib/materials-pdf');
    void import('jspdf');
    void import('jspdf-autotable');
  }, [hasToBuy]);

  function buildCopyText(rows: PurchaseRow[]): string {
    return buildPurchaseText(rows, {
      unit: (unit) => t(`material.unit.${unit}`),
      requested: t('material.list.requestedTag'),
    });
  }

  async function handleDownloadPdf(rows: PurchaseRow[]) {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const { buildPurchasePdf, purchaseFileName } = await import('@/lib/materials-pdf');
      const now = new Date();
      const blob = await buildPurchasePdf({
        projectName: projectData?.project.name ?? '',
        date: now,
        dateLabel: format(now, 'P', { locale: dateLocale }),
        rows,
        labels: {
          title: t('material.pdf.title'),
          summary: `${t('material.pdf.materials', { count: rows.length })} · ${t('material.pdf.suppliers', { count: countSuppliers(rows) })}`,
          columns: {
            material: t('material.pdf.columnMaterial'),
            quantity: t('material.pdf.columnQuantity'),
            supplier: t('material.pdf.columnSupplier'),
          },
          noSupplier: t('material.list.noSupplier'),
          requested: t('material.list.requestedTag'),
          page: (page, total) => t('material.pdf.page', { page, total }),
          unit: (unit) => t(`material.unit.${unit}`),
        },
      });
      const fileName = purchaseFileName(projectData?.project.name ?? '', now);
      const file = new File([blob], fileName, { type: 'application/pdf' });

      // En el celular lo útil es mandarlo —por WhatsApp al proveedor, o
      // guardarlo en Archivos—, así que abre la hoja de compartir. En
      // escritorio esa hoja es un estorbo: descarga directa.
      const isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
      if (
        isTouch &&
        typeof navigator.canShare === 'function' &&
        typeof navigator.share === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], title: fileName });
        } catch (error) {
          // Cancelar la hoja no es un error. Cualquier otra cosa sí.
          if (!(error instanceof DOMException && error.name === 'AbortError')) throw error;
        }
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Revocar de inmediato cancela la descarga en algunos navegadores.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success(t('material.list.pdfDownloaded'));
    } catch {
      toast.error(t('material.errors.pdf'));
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleCopy(rows: PurchaseRow[]) {
    try {
      await copyText(buildCopyText(rows));
      toast.success(t('material.list.copied'));
    } catch {
      toast.error(t('material.errors.copy'));
    }
  }

  async function handleShare(rows: PurchaseRow[]) {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: buildCopyText(rows) });
      } catch {
        // El usuario canceló el share sheet — no es un error a mostrar.
      }
    }
  }

  if (isError) return <PageLayout isError />;
  if (isLoading || !materialsData) return <PageLayout isLoading />;

  const canShare = typeof navigator.share === 'function';
  const total = materialsData.materials.length;
  const highlighted = materialsData.materials.find((m) => m.id === highlightedId);
  const selectedMaterials = selectedToBuy.length > 0 ? selectedToBuy : selectedBought;

  function selectionBar(exportable: boolean) {
    return (
      <SelectionBar
        selected={selectedMaterials}
        exportable={exportable}
        canShare={canShare}
        generatingPdf={generatingPdf}
        onAction={setPendingBulk}
        onDownloadPdf={() => void handleDownloadPdf(selectedRows)}
        onCopy={() => void handleCopy(selectedRows)}
        onShare={() => void handleShare(selectedRows)}
        onClear={clearSelection}
      />
    );
  }

  /** La casilla de toda la pestaña, a la izquierda de la barra de arriba. */
  function selectAll(materials: MaterialItem[]) {
    if (!selection || materials.length === 0) return null;
    return (
      <div className="flex items-center gap-2">
        <GroupCheckbox
          ids={materials.map((material) => material.id)}
          selected={selected}
          label={t('material.bulk.selectAll')}
          onSetMany={setMany}
        />
        <span aria-hidden className="text-sm text-muted-foreground">
          {t('material.bulk.selectAll')}
        </span>
      </div>
    );
  }

  const bulkCount = selectedMaterials.length;
  const bulkActions = bulkActionsFor(selectedMaterials);

  return (
    // Sin título: la sección ya se llama así en el menú y en el encabezado.
    <PageLayout
      // Mientras hay selección, la barra ocupa el lugar del botón flotante.
      action={canWrite && !hasSelection ? <NewMaterialButton projectId={projectId!} /> : undefined}
      empty={total === 0 ? { icon: Package, title: t('material.list.empty') } : undefined}
    >
      {/*
        `defaultValue` y no controlado: la pestaña del material pedido se
        elige una vez, al llegar. Si después cambia de estado y pasa a la
        otra pestaña, la pantalla no salta detrás de él.
      */}
      <div ref={panelRef} tabIndex={-1} className={cn('outline-none', hasSelection && 'max-sm:pb-24')}>
      <Tabs
        defaultValue={highlighted ? materialTab(highlighted.status) : 'toBuy'}
        onValueChange={clearSelection}
        className="gap-4"
      >
        <TabsList>
          <TabsTrigger value="toBuy">
            {t('material.list.toBuy')} ({toBuy.length})
          </TabsTrigger>
          <TabsTrigger value="bought">
            {t('material.list.bought')} ({bought.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="toBuy"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-surface"
        >
          {toBuy.length > 0 && hasSelection && (
            <div className="flex flex-wrap items-center gap-2">
              {selectAll(toBuy)}
              {selectionBar(true)}
            </div>
          )}
          {toBuy.length > 0 && !hasSelection && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="mr-auto">{selectAll(toBuy)}</div>
              <Button
                variant="outline"
                size="sm"
                className="max-sm:min-h-11"
                onClick={() => void handleDownloadPdf(purchaseRows)}
                disabled={generatingPdf}
                aria-busy={generatingPdf}
              >
                {generatingPdf ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
                {generatingPdf ? t('material.list.generatingPdf') : t('material.list.downloadPdf')}
              </Button>
              <Button variant="outline" size="sm" className="max-sm:min-h-11" onClick={() => void handleCopy(purchaseRows)}>
                <Copy className="size-4" />
                {t('material.list.copyList')}
              </Button>
              {canShare && (
                <Button variant="outline" size="sm" className="max-sm:min-h-11" onClick={() => void handleShare(purchaseRows)}>
                  <Share2 className="size-4" />
                  {t('material.list.share')}
                </Button>
              )}
            </div>
          )}

          {toBuyGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('material.list.toBuyEmpty')}</p>
          ) : (
            <div className="flex flex-col gap-5">
              {toBuyGroups.map((group) => (
                <ToBuyGroup
                  key={group.activityId ?? 'none'}
                  name={group.activity?.name ?? null}
                  startDate={group.activity?.startDate}
                  materials={group.items}
                  projectId={projectId!}
                  canEdit={canWrite}
                  highlightedId={highlightedId}
                  selection={selection}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="bought"
          className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-surface"
        >
          {bought.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('material.list.boughtEmpty')}</p>
          ) : (
            <>
              {selection && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectAll(bought)}
                  {hasSelection && selectionBar(false)}
                </div>
              )}
              <BoughtGroup
                title={t('material.list.onTheWay')}
                materials={onTheWay}
                projectId={projectId!}
                canEdit={canWrite}
                highlightedId={highlightedId}
                activityById={activityById}
                selection={selection}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
              <BoughtGroup
                title={t('material.list.onSite')}
                materials={onSite}
                projectId={projectId!}
                canEdit={canWrite}
                highlightedId={highlightedId}
                activityById={activityById}
                selection={selection}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
      </div>

      <MaterialDrawer
        projectId={projectId!}
        material={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <AlertDialog open={pendingBulk !== null} onOpenChange={(open) => !open && setPendingBulk(null)}>
        <AlertDialogContent
          // Las filas que abrieron el diálogo se van de la pestaña al confirmar.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            panelRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingBulk?.kind === 'delete'
                ? t('material.bulk.deleteTitle', { count: bulkCount })
                : t('material.list.confirmStatusTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBulk?.kind === 'delete'
                ? t('material.bulk.deleteBody')
                : pendingBulk &&
                  t('material.bulk.confirmStatusBody', {
                    count: bulkCount,
                    status: t(`material.status.${pendingBulk.status}`),
                  })}
              {/* Que el bloqueo no sea una sorpresa, igual que con uno solo. */}
              {pendingBulk?.kind === 'status' &&
                bulkActions.locksSome &&
                ` ${t('material.bulk.confirmStatusLockWarning')}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={pendingBulk?.kind === 'delete' ? buttonVariants({ variant: 'destructive' }) : undefined}
              onClick={() => confirmBulk(selectedMaterials)}
            >
              {pendingBulk?.kind === 'delete' ? t('material.list.delete') : t('common.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent
          // La fila que abrió el diálogo se desmonta al borrar: sin esto el
          // foco se pierde en el <body>. Va al panel de la lista.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            panelRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t('material.list.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting &&
                t('material.list.deleteBody', {
                  name: deleting.name,
                  quantity: deleting.quantity,
                  unit: t(`material.unit.${deleting.unit}`),
                })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (deleting) deleteMaterial.mutate(deleting.id);
                setDeleting(null);
              }}
            >
              {t('material.list.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

export default ProjectMaterialsPage;
