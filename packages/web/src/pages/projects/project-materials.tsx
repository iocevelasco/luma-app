import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMaterialSchema,
  type CreateMaterialInput,
  type MaterialItem,
  type MaterialStatus,
} from '@luma/shared';
import { differenceInCalendarDays, format } from 'date-fns';
import { Copy, MoreHorizontal, Package, Plus, Share2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
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
import { FormDrawer } from '@/components/common/form-drawer';
import { PageLayout } from '@/components/layout/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useCreateMaterial,
  useMaterials,
  useUpdateMaterial,
} from '@/hooks/materials/use-material-queries';
import { useProjectCapabilities } from '@/hooks/projects/use-project-capabilities';
import { useDateLocale } from '@/hooks/use-date-locale';
import { materialTab, organizeMaterials } from '@/lib/materials';
import { cn } from '@/lib/utils';

const MATERIAL_UNITS = ['un', 'm', 'm2', 'm3', 'kg', 'l', 'bolsa', 'rollo', 'global'] as const;
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
function NewMaterialDrawer({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const createMaterial = useCreateMaterial(projectId);
  const { data: activitiesData } = useAllActivities(projectId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateMaterialInput>({ resolver: zodResolver(createMaterialSchema) });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        {t('material.list.newTitle')}
      </Button>

      <FormDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title={t('material.list.newTitle')}
        fieldCount={6}
        submitLabel={t('material.list.newSubmit')}
        isSubmitting={createMaterial.isPending}
        error={createMaterial.error}
        onSubmit={handleSubmit((values) =>
          createMaterial.mutate(values, {
            onSuccess: () => {
              reset();
              setOpen(false);
            },
          }),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="material-name">{t('material.fields.name')}</Label>
              <Input aria-invalid={Boolean(errors.name)} id="material-name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="material-quantity">{t('material.fields.quantity')}</Label>
              <Input
                aria-invalid={Boolean(errors.quantity)}
                id="material-quantity"
                inputMode="decimal"
                {...register('quantity', { valueAsNumber: true })}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="material-unit">{t('material.fields.unit')}</Label>
              <Controller
                control={control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={Boolean(errors.unit)} id="material-unit">
                      <SelectValue placeholder={t('material.fields.unitPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {t(`material.unit.${unit}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.unit && <p className="text-sm text-destructive">{errors.unit.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="material-activity">{t('material.fields.activity')}</Label>
              <Controller
                control={control}
                name="activityId"
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="material-activity">
                      <SelectValue placeholder={t('material.fields.activityPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(activitiesData?.activities ?? []).map((activity) => (
                        <SelectItem key={activity.id} value={activity.id}>
                          {activity.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="material-cost">{t('material.fields.estimatedCost')}</Label>
              <Input
                aria-invalid={Boolean(errors.estimatedCost)}
                id="material-cost"
                inputMode="decimal"
                {...register('estimatedCost', {
                  setValueAs: (value) => (value === '' ? undefined : Number(value)),
                })}
              />
              {errors.estimatedCost && (
                <p className="text-sm text-destructive">{errors.estimatedCost.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="material-supplier">{t('material.fields.supplier')}</Label>
              <Input id="material-supplier" {...register('supplier')} />
            </div>
        </div>
      </FormDrawer>
    </>
  );
}

function MaterialRow({
  material,
  projectId,
  canEdit,
  activityName,
  highlighted = false,
}: {
  material: MaterialItem;
  projectId: string;
  canEdit: boolean;
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
          <Button type="button" variant="outline" size="sm" onClick={() => setPendingStatus(next)}>
            {t(`material.action.${next}`)}
          </Button>
        )}

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t('material.list.changeStatus')}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {MATERIAL_STATUSES.filter((status) => status !== material.status).map((status) => (
                <DropdownMenuItem key={status} onSelect={() => setPendingStatus(status)}>
                  {t(`material.status.${status}`)}
                </DropdownMenuItem>
              ))}
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
}: {
  /** `null` = materiales sin actividad. */
  name: string | null;
  startDate?: string;
  materials: MaterialItem[];
  projectId: string;
  canEdit: boolean;
  highlightedId: string | null;
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
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: materialsData, isLoading, isError } = useMaterials(projectId);
  const { data: activitiesData } = useAllActivities(projectId);

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

  function buildCopyText(): string {
    return toBuy
      .map((m) => `- ${m.name}: ${m.quantity} ${t(`material.unit.${m.unit}`)}`)
      .join('\n');
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
      action={canWrite ? <NewMaterialDrawer projectId={projectId!} /> : undefined}
      empty={total === 0 ? { icon: Package, title: t('material.list.empty') } : undefined}
    >
      {/*
        `defaultValue` y no controlado: la pestaña del material pedido se
        elige una vez, al llegar. Si después cambia de estado y pasa a la
        otra pestaña, la pantalla no salta detrás de él.
      */}
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
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="size-4" />
                {t('material.list.copyList')}
              </Button>
              {canShare && (
                <Button variant="outline" size="sm" onClick={handleShare}>
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
    </PageLayout>
  );
}

export default ProjectMaterialsPage;
