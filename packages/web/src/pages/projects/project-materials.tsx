import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type MaterialInvoiceRef, type MaterialItem, type MaterialStatus } from '@luma/shared';
import { differenceInCalendarDays, format } from 'date-fns';
import {
  ArrowRight,
  CalendarClock,
  Camera,
  ChevronDown,
  Copy,
  FileDown,
  FileSpreadsheet,
  ImageOff,
  Link2,
  MoreHorizontal,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  ReceiptText,
  Share2,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
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
import { fromDayKey } from '@/lib/day-key';
import { MaterialDrawer } from '@/components/materials/material-drawer';
import { MaterialPhotoThumb, useValidMaterialPhoto } from '@/components/materials/material-photo';
import { MaterialInvoiceDialog } from '@/components/materials/material-invoice-dialog';
import { ProviderCombobox } from '@/components/materials/provider-combobox';
import { MaterialStatusBadge } from '@/components/materials/material-status-badge';
import { PageLayout } from '@/components/layout/page-layout';
import { Badge } from '@/components/ui/badge';
import { TriStateCheckbox } from '@/components/common/tri-state-checkbox';
import {
  ListSection,
  ListSections,
  RowCard,
  RowCardAction,
  RowCardEnd,
  RowCardList,
} from '@/components/common/row-card-list';
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
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useBulkDeleteMaterials,
  useBulkUpdateMaterials,
  useDeleteMaterial,
  useDeleteMaterialInvoice,
  useMaterialPhotoLoader,
  useMaterials,
  useRemoveMaterialPhoto,
  useUpdateMaterial,
  useUploadMaterialPhoto,
} from '@/hooks/materials/use-material-queries';
import { MATERIAL_PHOTO_ACCEPT } from '@/lib/material-photo';
import {
  loadRowPhotos,
  MAX_SHARED_PHOTOS,
  PDF_PHOTO,
  PHOTO_PREFETCH_CONCURRENCY,
  photoFileName,
  resizePhoto,
  runPool,
  type ResizedPhoto,
} from '@/lib/material-photo-export';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProject } from '@/hooks/projects/use-project-queries';
import { useProviders } from '@/hooks/providers/use-provider-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import {
  NEXT_MATERIAL_STATUS,
  buildPurchaseCsv,
  buildPurchaseRows,
  buildPurchaseText,
  bulkActionsFor,
  countSuppliers,
  countUnrequested,
  materialTab,
  organizeMaterials,
  providerMatchFor,
  selectionState,
  supplierName,
  type PurchaseListKind,
  type PurchaseRow,
} from '@/lib/materials';
import { downloadBlob } from '@/lib/download-blob';
import { cn } from '@/lib/utils';

const MATERIAL_STATUSES: MaterialStatus[] = ['pendiente', 'solicitado', 'comprado', 'en_obra'];

/** Faltan hasta tantos días para que una actividad empiece y se marca como urgente. */
const URGENT_WITHIN_DAYS = 7;

/** Cancelar la hoja de compartir no es un error; lo demás (en Safari, el gesto vencido) sí. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

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
 * Lo que cambia entre exportar la lista de compras y la de lo ya comprado.
 * La construcción es una sola (`buildPurchaseRows`); acá sólo los textos.
 */
const EXPORT_COPY: Record<PurchaseListKind, { title: string; tag: string; filePrefix: string }> = {
  toBuy: { title: 'material.pdf.title', tag: 'material.list.requestedTag', filePrefix: 'compras' },
  bought: { title: 'material.pdf.titleBought', tag: 'material.list.onSiteTag', filePrefix: 'comprados' },
};

/** Descargar (PDF o CSV), Copiar y Compartir: los mismos en las dos pestañas. */
function ExportActions({
  generatingPdf,
  canShare,
  onDownloadPdf,
  onDownloadCsv,
  onCopy,
  onShare,
  onWarm,
}: {
  generatingPdf: boolean;
  canShare: boolean;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
  onCopy: () => void;
  onShare: () => void;
  /** Hay señal de que se va a exportar: que se vayan bajando las fotos. */
  onWarm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && onWarm()}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="max-sm:min-h-11"
            disabled={generatingPdf}
            aria-busy={generatingPdf}
          >
            {generatingPdf ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
            {generatingPdf ? t('material.list.generatingPdf') : t('material.export.download')}
            <ChevronDown aria-hidden className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="max-sm:min-h-11" onSelect={onDownloadPdf}>
            <FileDown className="size-4" />
            <ExportFormat label={t('material.export.pdf')} hint={t('material.export.pdfHint')} />
          </DropdownMenuItem>
          <DropdownMenuItem className="max-sm:min-h-11" onSelect={onDownloadCsv}>
            <FileSpreadsheet className="size-4" />
            <ExportFormat label={t('material.export.csv')} hint={t('material.export.csvHint')} />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        size="sm"
        className="max-sm:min-h-11"
        onClick={onCopy}
        onPointerEnter={onWarm}
        onFocus={onWarm}
      >
        <Copy className="size-4" />
        {t('material.list.copyList')}
      </Button>
      {canShare && (
        <Button
          variant="outline"
          size="sm"
          className="max-sm:min-h-11"
          onClick={onShare}
          // `pointerdown` y no sólo `enter`: en el celular no hay hover, y es lo
          // más temprano que se sabe que viene el toque.
          onPointerEnter={onWarm}
          onPointerDown={onWarm}
          onFocus={onWarm}
        >
          <Share2 className="size-4" />
          {t('material.list.share')}
        </Button>
      )}
    </>
  );
}

/** El nombre del formato y, abajo, para qué sirve: quien elige no tiene que adivinar qué es un CSV. */
function ExportFormat({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="flex flex-col">
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </span>
  );
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
  providers,
  onEdit,
  onDelete,
  onInvoice,
  onDeleteInvoice,
}: {
  material: MaterialItem;
  selection?: RowSelection;
  /** Para sugerir vincular un proveedor escrito a mano. Sin esto, no sugiere. */
  providers?: readonly { id: string; name: string }[];
  projectId: string;
  canEdit: boolean;
  /** Los diálogos viven en la página: una lista larga no monta uno por fila. */
  onEdit: (material: MaterialItem) => void;
  onDelete: (material: MaterialItem) => void;
  /** Cargar la factura de este material. Sin esto (sin permiso) no se ofrece. */
  onInvoice?: (materials: MaterialItem[]) => void;
  onDeleteInvoice?: (invoice: MaterialInvoiceRef) => void;
  /** Sólo donde la fila no está bajo el encabezado de su actividad. */
  activityName?: string;
  /** El material al que se llegó con `?material=` desde el resumen de la obra. */
  highlighted?: boolean;
}) {
  const { t } = useTranslation();
  const updateMaterial = useUpdateMaterial(projectId);
  const [pendingStatus, setPendingStatus] = useState<MaterialStatus | null>(null);
  // La foto se agrega o saca en cualquier estado: no es corregir el material.
  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadMaterialPhoto(projectId);
  const removePhoto = useRemoveMaterialPhoto(projectId);
  const validPhoto = useValidMaterialPhoto();
  const [confirmingPhotoRemoval, setConfirmingPhotoRemoval] = useState(false);
  const next = NEXT_MATERIAL_STATUS[material.status];
  const rowRef = useRef<HTMLLIElement>(null);
  const supplier = supplierName(material);
  const match = canEdit && providers ? providerMatchFor(material, providers) : null;

  // Sin el scroll, la fila puede quedar abajo del pliegue y el click en el
  // resumen parece no haber hecho nada.
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: 'center' });
  }, [highlighted]);

  return (
    <RowCard ref={rowRef} highlighted={highlighted} className="justify-between">
      <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
        {selection && (
          <SelectCheckbox
            state={selection.selected.has(material.id)}
            label={t('material.bulk.select', { name: material.name })}
            onChange={(checked) => selection.onSetMany([material.id], checked)}
          />
        )}
        {material.photoUrl && <MaterialPhotoThumb url={material.photoUrl} name={material.name} />}
        <div className="min-w-0">
          <p className="font-medium">{material.name}</p>
          <p className="text-xs text-muted-foreground">
            {material.quantity} {t(`material.unit.${material.unit}`)}
            {supplier ? ` · ${supplier}` : ''}
            {material.providerActive === false && ` (${t('material.provider.inactive')})`}
            {activityName ? ` · ${activityName}` : ''}
            {/*
              Sólo cuando hay un proveedor del directorio que se llama igual:
              un "Sin vincular" en cada fila vieja sería ruido sin salida.
            */}
            {match && (
              <>
                {' · '}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-2 hover:underline max-sm:min-h-11"
                  aria-label={t('material.provider.linkAria', { name: match.name })}
                  disabled={updateMaterial.isPending}
                  onClick={() =>
                    updateMaterial.mutate({ materialId: material.id, payload: { providerId: match.id } })
                  }
                >
                  <Link2 aria-hidden className="size-3.5" />
                  {t('material.provider.link')}
                </button>
              </>
            )}
          </p>
        </div>
      </div>

      <RowCardEnd>
        {/*
          La factura se ve en la fila, antes del estado: es lo que responde
          "¿esto ya está documentado?" sin abrir Finanzas.
        */}
        {material.invoices && material.invoices.length > 0 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 max-sm:min-h-11"
                    aria-label={t('material.invoice.openMenu', {
                      count: material.invoices.length,
                      name: material.name,
                    })}
                  >
                    <ReceiptText aria-hidden className="size-4" />
                    {material.invoices.length > 1 && (
                      <span className="tabular-nums">{material.invoices.length}</span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                {t('material.invoice.tooltip', { count: material.invoices.length })}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end">
              {material.invoices.map((invoice) => (
                <div key={invoice.id}>
                  {invoice.url && (
                    <DropdownMenuItem asChild className="max-sm:min-h-11">
                      <a href={invoice.url} target="_blank" rel="noopener noreferrer">
                        <ReceiptText className="size-4" />
                        <span className="max-w-56 truncate">{invoice.fileName}</span>
                      </a>
                    </DropdownMenuItem>
                  )}
                  {invoice.canDelete && onDeleteInvoice && (
                    <DropdownMenuItem
                      variant="destructive"
                      className="max-sm:min-h-11"
                      onSelect={() => onDeleteInvoice(invoice)}
                    >
                      <Trash2 className="size-4" />
                      {t('material.invoice.delete')}
                    </DropdownMenuItem>
                  )}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <MaterialStatusBadge status={material.status} />

        {/*
          Una acción visible por fila, pero liviana: con borde, repetida en
          cada fila, armaba una columna de píldoras que se leía antes que el
          material. El outline queda para Cancelar y Volver (DESIGN.md).
        */}
        {canEdit && next && (
          <RowCardAction type="button" onClick={() => setPendingStatus(next)}>
            {t(`material.action.${next}`)}
            <ArrowRight aria-hidden className="size-4" />
          </RowCardAction>
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
            // En celular no entra junto al estado y la acción; editar sigue en "…" (IA-11).
            className="max-sm:hidden"
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

              {/* Lo Pendiente no se compró: no tiene factura. */}
              {onInvoice && material.status !== 'pendiente' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="max-sm:min-h-11" onSelect={() => onInvoice([material])}>
                    <ReceiptText className="size-4" />
                    {t('material.invoice.action')}
                  </DropdownMenuItem>
                </>
              )}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="max-sm:min-h-11"
                onSelect={() => photoInputRef.current?.click()}
              >
                <Camera className="size-4" />
                {t(material.photoUrl ? 'material.photo.change' : 'material.photo.add')}
              </DropdownMenuItem>
              {material.photoUrl && (
                <DropdownMenuItem
                  variant="destructive"
                  className="max-sm:min-h-11"
                  onSelect={() => setConfirmingPhotoRemoval(true)}
                >
                  <ImageOff className="size-4" />
                  {t('material.photo.remove')}
                </DropdownMenuItem>
              )}

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
      </RowCardEnd>

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

      {canEdit && (
        <input
          ref={photoInputRef}
          type="file"
          accept={MATERIAL_PHOTO_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = validPhoto(event.target.files?.[0]);
            // Permite volver a elegir el mismo archivo después de un rechazo.
            event.target.value = '';
            if (file) uploadPhoto.mutate({ materialId: material.id, file });
          }}
        />
      )}

      <AlertDialog open={confirmingPhotoRemoval} onOpenChange={setConfirmingPhotoRemoval}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('material.photo.removeTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('material.photo.removeBody', { name: material.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => removePhoto.mutate(material.id)}
            >
              {t('material.photo.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RowCard>
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
  providers,
  onEdit,
  onDelete,
  onInvoice,
  onDeleteInvoice,
}: {
  /** `null` = materiales sin actividad. */
  name: string | null;
  startDate?: string;
  materials: MaterialItem[];
  projectId: string;
  canEdit: boolean;
  highlightedId: string | null;
  selection?: RowSelection;
  providers?: readonly { id: string; name: string }[];
  onEdit: (material: MaterialItem) => void;
  onDelete: (material: MaterialItem) => void;
  /** Cargar la factura de este material. Sin esto (sin permiso) no se ofrece. */
  onInvoice?: (materials: MaterialItem[]) => void;
  onDeleteInvoice?: (invoice: MaterialInvoiceRef) => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const groupName = name ?? t('material.list.withoutActivity');

  const days = startDate ? differenceInCalendarDays(fromDayKey(startDate), new Date()) : null;
  const urgent = days !== null && days <= URGENT_WITHIN_DAYS;
  const unrequested = countUnrequested(materials);

  return (
    <ListSection
      label={groupName}
      leading={
        selection && (
          <GroupCheckbox
            ids={materials.map((material) => material.id)}
            selected={selection.selected}
            label={t('material.bulk.selectGroup', { name: groupName })}
            onSetMany={selection.onSetMany}
          />
        )
      }
      meta={
        (startDate || unrequested > 0) && (
          <>
            {/*
              Lo que pide acción, a la vista en el rótulo: con el orden por
              fecha, un Pendiente sin tarea queda último y bajo el pliegue.
              Mismo rojo que el tag "Pendiente": es la misma información.
            */}
            {unrequested > 0 && (
              <span className="font-medium text-tag-danger-fg">
                {t('material.list.unrequested', { count: unrequested })}
              </span>
            )}
            {startDate && (
              <span>
                {t('material.list.startsOn', {
                  date: format(fromDayKey(startDate), 'PP', { locale: dateLocale }),
                })}
              </span>
            )}
            {/*
              Calendario y no el reloj del tono: el reloj ya es "Solicitado",
              y la urgencia habla de la tarea, no del material.
            */}
            {urgent && (
              <Badge variant={days! < 0 ? 'danger' : 'warning'} icon={CalendarClock}>
                {days! < 0
                  ? t('material.list.startedAlready')
                  : days === 0
                    ? t('material.list.startsToday')
                    : t('material.list.startsInDays', { count: days! })}
              </Badge>
            )}
          </>
        )
      }
    >
      <RowCardList>
        {materials.map((material) => (
          <MaterialRow
            key={material.id}
            material={material}
            projectId={projectId}
            canEdit={canEdit}
            highlighted={material.id === highlightedId}
            selection={selection}
            providers={providers}
            onEdit={onEdit}
            onDelete={onDelete}
            onInvoice={onInvoice}
            onDeleteInvoice={onDeleteInvoice}
          />
        ))}
      </RowCardList>
    </ListSection>
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
  providers,
  onEdit,
  onDelete,
  onInvoice,
  onDeleteInvoice,
}: {
  title: string;
  materials: MaterialItem[];
  projectId: string;
  canEdit: boolean;
  highlightedId: string | null;
  activityById: ReadonlyMap<string, { name: string }>;
  selection?: RowSelection;
  providers?: readonly { id: string; name: string }[];
  onEdit: (material: MaterialItem) => void;
  onDelete: (material: MaterialItem) => void;
  /** Cargar la factura de este material. Sin esto (sin permiso) no se ofrece. */
  onInvoice?: (materials: MaterialItem[]) => void;
  onDeleteInvoice?: (invoice: MaterialInvoiceRef) => void;
}) {
  const { t } = useTranslation();
  if (materials.length === 0) return null;

  return (
    <ListSection
      label={title}
      meta={materials.length}
      leading={
        selection && (
          <GroupCheckbox
            ids={materials.map((material) => material.id)}
            selected={selection.selected}
            label={t('material.bulk.selectGroup', { name: title })}
            onSetMany={selection.onSetMany}
          />
        )
      }
    >
      <RowCardList>
        {materials.map((material) => (
          <MaterialRow
            key={material.id}
            material={material}
            projectId={projectId}
            canEdit={canEdit}
            highlighted={material.id === highlightedId}
            selection={selection}
            providers={providers}
            onEdit={onEdit}
            onDelete={onDelete}
            onInvoice={onInvoice}
            onDeleteInvoice={onDeleteInvoice}
            activityName={material.activityId ? activityById.get(material.activityId)?.name : undefined}
          />
        ))}
      </RowCardList>
    </ListSection>
  );
}

/** Lo que la barra de selección pide confirmar antes de mandar. */
type PendingBulk =
  | { kind: 'status'; status: MaterialStatus }
  | { kind: 'delete' }
  | { kind: 'provider' };

/**
 * La barra que reemplaza a "Descargar PDF / Copiar / Compartir" mientras hay
 * algo tildado. En el celular se despega y queda fija abajo, donde llega el
 * pulgar; en escritorio queda arriba de la lista, como en Gmail.
 *
 * Ofrece sólo lo que vale para todo lo seleccionado (`bulkActionsFor`).
 */
function SelectionBar({
  selected,
  canShare,
  generatingPdf,
  onAction,
  onInvoice,
  onDownloadPdf,
  onDownloadCsv,
  onCopy,
  onShare,
  onClear,
}: {
  selected: MaterialItem[];
  canShare: boolean;
  generatingPdf: boolean;
  onAction: (action: PendingBulk) => void;
  /** Sin esto (sin permiso) no se ofrece. */
  onInvoice?: () => void;
  onDownloadPdf: () => void;
  onDownloadCsv: () => void;
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

          {onInvoice && selected.every((material) => material.status !== 'pendiente') && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="max-sm:min-h-11" onSelect={onInvoice}>
                <ReceiptText className="size-4" />
                {t('material.invoice.action')}
              </DropdownMenuItem>
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem className="max-sm:min-h-11" disabled={generatingPdf} onSelect={onDownloadPdf}>
            <FileDown className="size-4" />
            <ExportFormat label={t('material.export.pdf')} hint={t('material.export.pdfHint')} />
          </DropdownMenuItem>
          <DropdownMenuItem className="max-sm:min-h-11" onSelect={onDownloadCsv}>
            <FileSpreadsheet className="size-4" />
            <ExportFormat label={t('material.export.csv')} hint={t('material.export.csvHint')} />
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

          {/* Asignar es corregir: sólo si todos siguen editables, como eliminar. */}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="max-sm:min-h-11" onSelect={() => onAction({ kind: 'provider' })}>
                <Truck className="size-4" />
                {t('material.bulk.assignProvider')}
              </DropdownMenuItem>
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
  const [bulkProviderId, setBulkProviderId] = useState<string | null>(null);

  // Gerente y supervisor gestionan las compras; lo decide la grilla.
  const { can } = useProjectCapabilities(projectId);
  const canWrite = can('material.write');
  const canInvoice = can('material.invoice.write');
  const deleteInvoice = useDeleteMaterialInvoice(projectId!);
  const [invoicing, setInvoicing] = useState<MaterialItem[] | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<MaterialInvoiceRef | null>(null);
  // Para vincular y asignar. Sin escritura no hace falta pedirlos.
  const { data: providersData } = useProviders(canWrite ? projectId : undefined);
  const providers = providersData?.providers;

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
  const boughtRows = useMemo(
    () => buildPurchaseRows(bought, i18n.language, 'bought'),
    [bought, i18n.language],
  );

  // Lo seleccionado se lee contra la lista actual: un material que otra
  // persona borró o pasó de pestaña deja de contar solo, sin limpiar nada.
  const selectedToBuy = useMemo(() => toBuy.filter((m) => selected.has(m.id)), [toBuy, selected]);
  const selectedBought = useMemo(() => bought.filter((m) => selected.has(m.id)), [bought, selected]);
  // La selección es de una pestaña a la vez: exporta con los textos de esa.
  const selectedKind: PurchaseListKind = selectedToBuy.length > 0 ? 'toBuy' : 'bought';
  const selectedRows = useMemo(
    () =>
      selectedKind === 'toBuy'
        ? buildPurchaseRows(selectedToBuy, i18n.language)
        : buildPurchaseRows(selectedBought, i18n.language, 'bought'),
    [selectedKind, selectedToBuy, selectedBought, i18n.language],
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
    else if (pendingBulk.kind === 'status') bulkUpdate.mutate({ ids, status: pendingBulk.status }, options);
    else if (bulkProviderId) bulkUpdate.mutate({ ids, providerId: bulkProviderId }, options);
    setPendingBulk(null);
    setBulkProviderId(null);
  }

  // Las fotos para exportar se bajan de forma perezosa: no al abrir la pantalla
  // (casi nadie exporta, y son archivos, no miniaturas) sino cuando hay señal de
  // que se va a exportar: abrir "Descargar", acercarse a Compartir o Copiar, o
  // tildar materiales. En Safari PDF y Compartir tienen que ocurrir dentro del
  // gesto, y bajar imágenes ahí lo deja afuera: por eso se adelanta con la
  // señal en vez de esperar al toque. Se piden de a pocas y ya vienen
  // reducidas desde que se suben.
  const loadPhoto = useMaterialPhotoLoader(projectId!);
  const pdfPhotoCache = useRef(new Map<string, Promise<ResizedPhoto | null>>());
  const pdfPhoto = useCallback(
    (row: PurchaseRow): Promise<ResizedPhoto | null> => {
      if (!row.photoVersion) return Promise.resolve(null);
      const key = `${row.id}:${row.photoVersion}`;
      let hit = pdfPhotoCache.current.get(key);
      if (!hit) {
        hit = loadPhoto(row.id, row.photoVersion)
          .then((original) => resizePhoto(original, PDF_PHOTO))
          .catch(() => {
            // No se guarda el fallo: la próxima vez que se pida, se reintenta.
            pdfPhotoCache.current.delete(key);
            return null;
          });
        pdfPhotoCache.current.set(key, hit);
      }
      return hit;
    },
    [loadPhoto],
  );
  /** Pide las fotos de esas filas. Las que ya están (o van en camino) no se piden de nuevo. */
  const warmPhotos = useCallback(
    (rows: PurchaseRow[]) => {
      const withPhoto = rows.filter((row) => row.photoVersion);
      if (withPhoto.length > 0) void runPool(withPhoto, PHOTO_PREFETCH_CONCURRENCY, pdfPhoto);
    },
    [pdfPhoto],
  );
  useEffect(() => {
    if (hasSelection) warmPhotos(selectedRows);
  }, [hasSelection, selectedRows, warmPhotos]);

  // El PDF y su librería pesan: se bajan apenas hay algo que descargar, no al
  // tocar el botón. En Safari, descargar o compartir tiene que ocurrir dentro
  // del gesto, y esperar un chunk grande lo deja afuera.
  const hasExportable = toBuy.length > 0 || bought.length > 0;
  useEffect(() => {
    if (!hasExportable) return;
    void import('@/lib/materials-pdf');
    void import('jspdf');
    void import('jspdf-autotable');
  }, [hasExportable]);

  function buildCopyText(rows: PurchaseRow[], kind: PurchaseListKind): string {
    return buildPurchaseText(rows, {
      unit: (unit) => t(`material.unit.${unit}`),
      tag: t(EXPORT_COPY[kind].tag),
    });
  }

  async function handleDownloadPdf(rows: PurchaseRow[], kind: PurchaseListKind) {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const { buildPurchasePdf, purchaseFileName } = await import('@/lib/materials-pdf');
      const now = new Date();
      // Casi siempre ya están listas: la pantalla las prepara apenas se muestra.
      // Una que no se pudo leer deja esa fila sin foto, no tira el PDF.
      const photos = new Map<string, ResizedPhoto>();
      await Promise.all(
        rows.map(async (row) => {
          const photo = await pdfPhoto(row);
          if (photo) photos.set(row.id, photo);
        }),
      );
      const blob = await buildPurchasePdf({
        photos,
        projectName: projectData?.project.name ?? '',
        date: now,
        dateLabel: format(now, 'P', { locale: dateLocale }),
        rows,
        labels: {
          title: t(EXPORT_COPY[kind].title),
          summary: `${t('material.pdf.materials', { count: rows.length })} · ${t('material.pdf.suppliers', { count: countSuppliers(rows) })}`,
          columns: {
            material: t('material.pdf.columnMaterial'),
            quantity: t('material.pdf.columnQuantity'),
            supplier: t('material.pdf.columnSupplier'),
            photo: t('material.pdf.columnPhoto'),
          },
          noSupplier: t('material.list.noSupplier'),
          tag: t(EXPORT_COPY[kind].tag),
          page: (page, total) => t('material.pdf.page', { page, total }),
          unit: (unit) => t(`material.unit.${unit}`),
        },
      });
      const fileName = purchaseFileName(projectData?.project.name ?? '', now, EXPORT_COPY[kind].filePrefix);
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
          return;
        } catch (error) {
          if (isAbortError(error)) return;
          // Cualquier otro motivo (en Safari, que el gesto ya venció) no es
          // razón para quedarse sin el PDF: se baja directo.
        }
      }

      downloadBlob(blob, fileName);
      toast.success(t('material.list.pdfDownloaded'));
    } catch {
      toast.error(t('material.errors.pdf'));
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleCopy(rows: PurchaseRow[], kind: PurchaseListKind) {
    try {
      await copyText(buildCopyText(rows, kind));
      toast.success(t('material.list.copied'));
    } catch {
      toast.error(t('material.errors.copy'));
    }
  }

  /**
   * El CSV de la misma lista, para Excel o una planilla. Sin fotos ni
   * costos, igual que el texto: son los mismos datos que el PDF.
   */
  async function handleDownloadCsv(rows: PurchaseRow[], kind: PurchaseListKind) {
    const { purchaseFileName } = await import('@/lib/materials-pdf');
    const now = new Date();
    const numberFormat = new Intl.NumberFormat(i18n.language, {
      useGrouping: false,
      maximumFractionDigits: 4,
    });
    const csv = buildPurchaseCsv(rows, {
      header: {
        material: t('material.pdf.columnMaterial'),
        quantity: t('material.pdf.columnQuantity'),
        unit: t('material.export.columnUnit'),
        supplier: t('material.pdf.columnSupplier'),
        note: t('material.export.columnNote'),
      },
      unit: (unit) => t(`material.unit.${unit}`),
      tag: t(EXPORT_COPY[kind].tag),
      number: (value) => numberFormat.format(value),
    });
    downloadBlob(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      purchaseFileName(projectData?.project.name ?? '', now, EXPORT_COPY[kind].filePrefix, 'csv'),
    );
    toast.success(t('material.export.csvDownloaded'));
  }

  /**
   * Compartir el texto de la lista y, si el dispositivo lo permite, las fotos
   * de los materiales: quien recibe ve de qué pieza se habla sin pedirla por
   * WhatsApp. Cada foto lleva el nombre del material.
   *
   * Las fotos ya están bajadas (ver el efecto de arriba) y ya vienen reducidas
   * desde que se subieron: acá no se procesa nada. En Safari compartir tiene
   * que pasar dentro del gesto, y cualquier trabajo largo antes lo deja afuera.
   */
  async function handleShare(rows: PurchaseRow[], kind: PurchaseListKind) {
    if (typeof navigator.share !== 'function') return;
    const text = buildCopyText(rows, kind);

    const photos = await loadRowPhotos(rows, loadPhoto);
    const taken = new Set<string>();
    const files = rows
      .filter((row) => photos.has(row.id))
      .slice(0, MAX_SHARED_PHOTOS)
      .map((row) => {
        const photo = photos.get(row.id) as Blob;
        return new File([photo], photoFileName(row.name, taken, photo.type), {
          type: photo.type || 'image/jpeg',
        });
      });
    const withPhotos =
      files.length > 0 && typeof navigator.canShare === 'function' && navigator.canShare({ files });

    /** `cancelled` si la persona cerró la hoja; `failed` si el sistema la rechazó. */
    const attempt = async (data: ShareData): Promise<'shared' | 'cancelled' | 'failed'> => {
      try {
        await navigator.share(data);
        return 'shared';
      } catch (error) {
        return isAbortError(error) ? 'cancelled' : 'failed';
      }
    };

    let result = await attempt(withPhotos ? { text, files } : { text });
    // Con las fotos no pudo: que no se quede sin la lista.
    if (result === 'failed' && withPhotos) result = await attempt({ text });
    if (result === 'failed') toast.error(t('material.errors.share'));
  }

  if (isError) return <PageLayout isError />;
  if (isLoading || !materialsData) return <PageLayout isLoading />;

  const canShare = typeof navigator.share === 'function';
  const total = materialsData.materials.length;
  const toBuyUnrequested = countUnrequested(toBuy);
  const highlighted = materialsData.materials.find((m) => m.id === highlightedId);
  const selectedMaterials = selectedToBuy.length > 0 ? selectedToBuy : selectedBought;

  function selectionBar() {
    return (
      <SelectionBar
        selected={selectedMaterials}
        canShare={canShare}
        generatingPdf={generatingPdf}
        onAction={setPendingBulk}
        onInvoice={canInvoice ? () => setInvoicing(selectedMaterials) : undefined}
        onDownloadPdf={() => void handleDownloadPdf(selectedRows, selectedKind)}
        onDownloadCsv={() => void handleDownloadCsv(selectedRows, selectedKind)}
        onCopy={() => void handleCopy(selectedRows, selectedKind)}
        onShare={() => void handleShare(selectedRows, selectedKind)}
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
      empty={total === 0 ? { icon: Package, title: t(canWrite ? 'material.list.empty' : 'material.list.emptyReadOnly') } : undefined}
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
          <TabsTrigger value="toBuy" icon={ShoppingCart}>
            {t('material.list.toBuy')} ({toBuy.length})
            {/* El total de lo que nadie pidió, visible desde cualquier pestaña. */}
            {toBuyUnrequested > 0 && (
              <span
                className="rounded-full bg-tag-danger-bg px-1.5 text-2xs font-medium tabular-nums text-tag-danger-fg"
                aria-label={t('material.list.unrequested', { count: toBuyUnrequested })}
                title={t('material.list.unrequested', { count: toBuyUnrequested })}
              >
                {toBuyUnrequested}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="bought" icon={PackageCheck}>
            {t('material.list.bought')} ({bought.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="toBuy" className="flex flex-col gap-4">
          {toBuy.length > 0 && hasSelection && (
            <div className="flex flex-wrap items-center gap-2">
              {selectAll(toBuy)}
              {selectionBar()}
            </div>
          )}
          {toBuy.length > 0 && !hasSelection && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="mr-auto">{selectAll(toBuy)}</div>
              <ExportActions
                generatingPdf={generatingPdf}
                canShare={canShare}
                onDownloadPdf={() => void handleDownloadPdf(purchaseRows, 'toBuy')}
                onDownloadCsv={() => void handleDownloadCsv(purchaseRows, 'toBuy')}
                onCopy={() => void handleCopy(purchaseRows, 'toBuy')}
                onShare={() => void handleShare(purchaseRows, 'toBuy')}
                onWarm={() => warmPhotos(purchaseRows)}
              />
            </div>
          )}

          {toBuyGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('material.list.toBuyEmpty')}</p>
          ) : (
            <ListSections>
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
                  providers={providers}
                  onEdit={setEditing}
                  onDelete={setDeleting}
                  onInvoice={canInvoice ? setInvoicing : undefined}
                  onDeleteInvoice={setDeletingInvoice}
                />
              ))}
            </ListSections>
          )}
        </TabsContent>

        <TabsContent value="bought" className="flex flex-col gap-4">
          {bought.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('material.list.boughtEmpty')}</p>
          ) : (
            <>
              {/* La misma barra que "Por comprar": la lista de lo comprado también se manda. */}
              {hasSelection ? (
                <div className="flex flex-wrap items-center gap-2">
                  {selectAll(bought)}
                  {selectionBar()}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <div className="mr-auto">{selectAll(bought)}</div>
                  <ExportActions
                    generatingPdf={generatingPdf}
                    canShare={canShare}
                    onDownloadPdf={() => void handleDownloadPdf(boughtRows, 'bought')}
                    onDownloadCsv={() => void handleDownloadCsv(boughtRows, 'bought')}
                    onCopy={() => void handleCopy(boughtRows, 'bought')}
                    onShare={() => void handleShare(boughtRows, 'bought')}
                    onWarm={() => warmPhotos(boughtRows)}
                  />
                </div>
              )}
              <ListSections>
              <BoughtGroup
                title={t('material.list.onTheWay')}
                materials={onTheWay}
                projectId={projectId!}
                canEdit={canWrite}
                highlightedId={highlightedId}
                activityById={activityById}
                selection={selection}
                providers={providers}
                onEdit={setEditing}
                onDelete={setDeleting}
                onInvoice={canInvoice ? setInvoicing : undefined}
                onDeleteInvoice={setDeletingInvoice}
              />
              <BoughtGroup
                title={t('material.list.onSite')}
                materials={onSite}
                projectId={projectId!}
                canEdit={canWrite}
                highlightedId={highlightedId}
                activityById={activityById}
                selection={selection}
                providers={providers}
                onEdit={setEditing}
                onDelete={setDeleting}
                onInvoice={canInvoice ? setInvoicing : undefined}
                onDeleteInvoice={setDeletingInvoice}
              />
              </ListSections>
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

      <MaterialInvoiceDialog
        projectId={projectId!}
        projectCurrency={projectData?.project.currency ?? ''}
        materials={invoicing ?? []}
        open={invoicing !== null}
        onOpenChange={(open) => !open && setInvoicing(null)}
        onCreated={clearSelection}
      />

      <AlertDialog open={deletingInvoice !== null} onOpenChange={(open) => !open && setDeletingInvoice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('material.invoice.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingInvoice && t('material.invoice.deleteBody', { name: deletingInvoice.fileName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: 'destructive' })}
              onClick={() => {
                if (deletingInvoice) deleteInvoice.mutate(deletingInvoice.id);
                setDeletingInvoice(null);
              }}
            >
              {t('material.invoice.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ResponsiveDialog
        open={pendingBulk?.kind === 'provider'}
        onOpenChange={(open) => {
          if (open) return;
          setPendingBulk(null);
          setBulkProviderId(null);
        }}
        title={t('material.bulk.assignTitle', { count: bulkCount })}
        description={t('material.bulk.assignHint')}
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-provider">{t('material.fields.supplier')}</Label>
            <ProviderCombobox
              id="bulk-provider"
              providers={providers ?? []}
              allowFreeText={false}
              value={{ providerId: bulkProviderId, supplier: '' }}
              onChange={(next) => setBulkProviderId(next.providerId)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingBulk(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!bulkProviderId || bulkUpdate.isPending}
              onClick={() => confirmBulk(selectedMaterials)}
            >
              {t('material.bulk.assignSubmit')}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      <AlertDialog
        open={pendingBulk !== null && pendingBulk.kind !== 'provider'}
        onOpenChange={(open) => !open && setPendingBulk(null)}
      >
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
                : pendingBulk?.kind === 'status' &&
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
