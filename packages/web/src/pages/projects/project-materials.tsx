import { useEffect, useMemo, useRef, useState } from 'react';
import { type MaterialItem, type MaterialStatus } from '@luma/shared';
import { differenceInCalendarDays, format } from 'date-fns';
import { Copy, FileDown, MoreHorizontal, Package, Pencil, Plus, Share2, Trash2 } from 'lucide-react';
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
import { PageLayout } from '@/components/layout/page-layout';
import { Badge } from '@/components/ui/badge';
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
  useDeleteMaterial,
  useMaterials,
  useUpdateMaterial,
} from '@/hooks/materials/use-material-queries';
import { useProject } from '@/hooks/projects/use-project-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import {
  buildPurchaseRows,
  buildPurchaseText,
  countSuppliers,
  materialTab,
  organizeMaterials,
} from '@/lib/materials';
import { cn } from '@/lib/utils';

const MATERIAL_STATUSES: MaterialStatus[] = ['pendiente', 'solicitado', 'comprado', 'en_obra'];

/**
 * El paso siguiente de cada material. El camino es lineal —se pide, se
 * compra, llega— y casi todos los cambios de estado son "el que sigue": un
 * botón con el nombre de lo que va a pasar, en vez de un selector con los
 * cuatro estados donde hay que saber cuál elegir. Los demás cambios (volver
 * atrás, corregir) quedan en el menú.
 */
const NEXT_STATUS: Partial<Record<MaterialStatus, MaterialStatus>> = {
  pendiente: 'solicitado',
  solicitado: 'comprado',
  comprado: 'en_obra',
};

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

function MaterialRow({
  material,
  projectId,
  canEdit,
  activityName,
  highlighted = false,
  onEdit,
  onDelete,
}: {
  material: MaterialItem;
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
  const next = NEXT_STATUS[material.status];
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
      <div className="min-w-0">
        <p className="font-medium">{material.name}</p>
        <p className="text-muted-foreground">
          {material.quantity} {t(`material.unit.${material.unit}`)}
          {material.supplier ? ` · ${material.supplier}` : ''}
          {activityName ? ` · ${activityName}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/*
          Rojo sólo lo que todavía no se pidió: eso es lo que puede frenar una
          actividad. Lo ya solicitado está en camino, y pintarlo igual que lo
          que nadie encargó borra la diferencia entre "hay que hacer algo" y
          "hay que esperar".
        */}
        <Badge
          variant={material.status === 'pendiente' ? 'destructive' : 'secondary'}
          className={cn(material.status === 'solicitado' && 'bg-warning text-warning-foreground')}
        >
          {t(`material.status.${material.status}`)}
        </Badge>

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
          menú y la línea de arriba de la lista.
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
  onEdit: (material: MaterialItem) => void;
  onDelete: (material: MaterialItem) => void;
}) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();

  const days = startDate ? differenceInCalendarDays(fromDayKey(startDate), new Date()) : null;
  const urgent = days !== null && days <= URGENT_WITHIN_DAYS;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
        <p className="text-sm font-medium">{name ?? t('material.list.withoutActivity')}</p>
        {startDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t('material.list.startsOn', {
                date: format(fromDayKey(startDate), 'PP', { locale: dateLocale }),
              })}
            </span>
            {urgent && (
              <Badge variant={days! < 0 ? 'destructive' : 'default'} className={cn(days! >= 0 && 'bg-warning text-warning-foreground')}>
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
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
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

  // Un solo drawer y un solo diálogo de borrado para toda la lista.
  const [editing, setEditing] = useState<MaterialItem | null>(null);
  const [deleting, setDeleting] = useState<MaterialItem | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

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

  function buildCopyText(): string {
    return buildPurchaseText(purchaseRows, {
      unit: (unit) => t(`material.unit.${unit}`),
      requested: t('material.list.requestedTag'),
    });
  }

  async function handleDownloadPdf() {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const { buildPurchasePdf, purchaseFileName } = await import('@/lib/materials-pdf');
      const now = new Date();
      const blob = await buildPurchasePdf({
        projectName: projectData?.project.name ?? '',
        date: now,
        dateLabel: format(now, 'P', { locale: dateLocale }),
        rows: purchaseRows,
        labels: {
          title: t('material.pdf.title'),
          summary: `${t('material.pdf.materials', { count: purchaseRows.length })} · ${t('material.pdf.suppliers', { count: countSuppliers(purchaseRows) })}`,
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

  async function handleCopy() {
    try {
      await copyText(buildCopyText());
      toast.success(t('material.list.copied'));
    } catch {
      toast.error(t('material.errors.copy'));
    }
  }

  async function handleShare() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: buildCopyText() });
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

  return (
    // Sin título: la sección ya se llama así en el menú y en el encabezado.
    <PageLayout
      action={canWrite ? <NewMaterialButton projectId={projectId!} /> : undefined}
      empty={total === 0 ? { icon: Package, title: t('material.list.empty') } : undefined}
    >
      {/*
        `defaultValue` y no controlado: la pestaña del material pedido se
        elige una vez, al llegar. Si después cambia de estado y pasa a la
        otra pestaña, la pantalla no salta detrás de él.
      */}
      {canWrite && (
        <p className="text-sm text-muted-foreground">{t('material.list.lockedHint')}</p>
      )}
      <div ref={panelRef} tabIndex={-1} className="outline-none">
      <Tabs defaultValue={highlighted ? materialTab(highlighted.status) : 'toBuy'} className="gap-4">
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
          {toBuy.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="max-sm:min-h-11"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                aria-busy={generatingPdf}
              >
                {generatingPdf ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
                {generatingPdf ? t('material.list.generatingPdf') : t('material.list.downloadPdf')}
              </Button>
              <Button variant="outline" size="sm" className="max-sm:min-h-11" onClick={handleCopy}>
                <Copy className="size-4" />
                {t('material.list.copyList')}
              </Button>
              {canShare && (
                <Button variant="outline" size="sm" className="max-sm:min-h-11" onClick={handleShare}>
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
              {onTheWay.length > 0 && (
                <div className="flex flex-col">
                  <p className="border-b border-border pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('material.list.onTheWay')} ({onTheWay.length})
                  </p>
                  <ul className="flex flex-col divide-y divide-border">
                    {onTheWay.map((material) => (
                      <MaterialRow
                        key={material.id}
                        material={material}
                        projectId={projectId!}
                        canEdit={canWrite}
                        highlighted={material.id === highlightedId}
                        onEdit={setEditing}
                        onDelete={setDeleting}
                        activityName={
                          material.activityId ? activityById.get(material.activityId)?.name : undefined
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
              {onSite.length > 0 && (
                <div className="flex flex-col">
                  <p className="border-b border-border pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t('material.list.onSite')} ({onSite.length})
                  </p>
                  <ul className="flex flex-col divide-y divide-border">
                    {onSite.map((material) => (
                      <MaterialRow
                        key={material.id}
                        material={material}
                        projectId={projectId!}
                        canEdit={canWrite}
                        highlighted={material.id === highlightedId}
                        onEdit={setEditing}
                        onDelete={setDeleting}
                        activityName={
                          material.activityId ? activityById.get(material.activityId)?.name : undefined
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}
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
