import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMaterialSchema,
  type CreateMaterialInput,
  type MaterialItem,
  type MaterialStatus,
} from '@luma/shared';
import { Copy, Share2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
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
import { RouteError } from '@/components/routes/route-error';
import { RouteLoading } from '@/components/routes/route-loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import {
  useCreateMaterial,
  useMaterials,
  useUpdateMaterial,
} from '@/hooks/materials/use-material-queries';
import { useProject } from '@/hooks/projects/use-project-queries';

const MATERIAL_UNITS = ['un', 'm', 'm2', 'm3', 'kg', 'l', 'bolsa', 'rollo', 'global'] as const;
const MATERIAL_STATUSES: MaterialStatus[] = ['pendiente', 'solicitado', 'comprado', 'en_obra'];

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

function NewMaterialForm({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
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
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium">{t('material.list.newTitle')}</h3>
      <form
        className="flex flex-col gap-4"
        onSubmit={handleSubmit((values) =>
          createMaterial.mutate(values, { onSuccess: () => reset() }),
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="material-name">{t('material.fields.name')}</Label>
              <Input id="material-name" {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="material-quantity">{t('material.fields.quantity')}</Label>
              <Input
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
                    <SelectTrigger id="material-unit">
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

          <div className="flex justify-end">
            <Button type="submit" disabled={createMaterial.isPending}>
              {createMaterial.isPending ? t('common.loading') : t('material.list.newSubmit')}
            </Button>
          </div>
      </form>
    </div>
  );
}

function MaterialRow({
  material,
  projectId,
  canEdit,
}: {
  material: MaterialItem;
  projectId: string;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const updateMaterial = useUpdateMaterial(projectId);
  const [pendingStatus, setPendingStatus] = useState<MaterialStatus | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm last:border-b-0">
      <div>
        <p className="font-medium">{material.name}</p>
        <p className="text-muted-foreground">
          {material.quantity} {t(`material.unit.${material.unit}`)}
          {material.supplier ? ` · ${material.supplier}` : ''}
        </p>
      </div>
      {canEdit ? (
        <Select
          value={material.status}
          onValueChange={(value) => setPendingStatus(value as MaterialStatus)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`material.status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-muted-foreground">{t(`material.status.${material.status}`)}</span>
      )}

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
    </div>
  );
}

export function ProjectMaterialsPage() {
  const { t } = useTranslation();
  const { projectId } = useParams<{ projectId: string }>();
  const { data: projectData } = useProject(projectId);
  const { data: materialsData, isLoading, isError } = useMaterials(projectId);
  const { data: activitiesData } = useAllActivities(projectId);

  const isOwner = Boolean(projectData?.project.isOwner);

  const activityNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const activity of activitiesData?.activities ?? []) map.set(activity.id, activity.name);
    return map;
  }, [activitiesData]);

  const grouped = useMemo(() => {
    const result: Record<MaterialStatus, MaterialItem[]> = {
      pendiente: [],
      solicitado: [],
      comprado: [],
      en_obra: [],
    };
    for (const material of materialsData?.materials ?? []) {
      result[material.status].push(material);
    }
    return result;
  }, [materialsData]);

  function buildCopyText(): string {
    const items = (materialsData?.materials ?? []).filter(
      (m) => m.status === 'pendiente' || m.status === 'solicitado',
    );
    return items.map((m) => `- ${m.name}: ${m.quantity} ${t(`material.unit.${m.unit}`)}`).join('\n');
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

  if (isError) return <RouteError />;
  if (isLoading || !materialsData) return <RouteLoading />;

  const canShare = typeof navigator.share === 'function';

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-3 md:p-4">
      {isOwner && <NewMaterialForm projectId={projectId!} />}

      <div className="flex flex-col gap-6 border-t border-border pt-6">
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t('material.list.title')}</h3>
          <div className="flex gap-2">
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
        </div>
        <div className="flex flex-col gap-6">
          {MATERIAL_STATUSES.map((status) => {
            const items = grouped[status];
            if (items.length === 0) return null;
            const withActivity = items.filter((m) => m.activityId);
            const withoutActivity = items.filter((m) => !m.activityId);
            return (
              <div key={status} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">
                  {t(`material.status.${status}`)} ({items.length})
                </h3>
                {withActivity.map((material) => (
                  <div key={material.id}>
                    <p className="text-xs text-muted-foreground">
                      {activityNameById.get(material.activityId!) ?? ''}
                    </p>
                    <MaterialRow material={material} projectId={projectId!} canEdit={isOwner} />
                  </div>
                ))}
                {withoutActivity.length > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg border border-dashed p-2">
                    <p className="text-xs text-muted-foreground">
                      {t('material.list.withoutActivity')}
                    </p>
                    {withoutActivity.map((material) => (
                      <MaterialRow
                        key={material.id}
                        material={material}
                        projectId={projectId!}
                        canEdit={isOwner}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {materialsData.materials.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('material.list.empty')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProjectMaterialsPage;
