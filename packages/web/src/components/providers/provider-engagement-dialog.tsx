import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createProviderEngagementSchema,
  type CreateProviderEngagementInput,
  type Provider,
  type ProviderEngagement,
  type ProviderEngagementStatus,
  type ProviderRequirementType,
} from '@luma/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateEngagement,
  useDeleteEngagement,
  useProviderEngagements,
  useSetRequirementMet,
  useUpdateEngagement,
} from '@/hooks/providers/use-engagement-queries';
import { formatMoney } from '@/lib/format-money';

const ENGAGEMENT_STATUSES: ProviderEngagementStatus[] = [
  'solicitada',
  'cotizada',
  'aprobada',
  'rechazada',
];

/** `otro` no entra: necesita texto libre y se maneja aparte. */
const STANDARD_REQUIREMENTS: ProviderRequirementType[] = [
  'materiales_en_obra',
  'personal_libre',
  'area_desocupada',
  'actividad_previa',
];

function statusVariant(status: ProviderEngagementStatus) {
  if (status === 'aprobada') return 'default' as const;
  if (status === 'rechazada') return 'destructive' as const;
  return 'secondary' as const;
}

/**
 * Alta y edición de una contratación. Los requisitos se eligen por tipo, y al
 * editar se conserva el `met` de los que ya estaban: cambiar un monto no
 * puede borrar el avance de la checklist que alguien viene tildando en obra.
 */
function EngagementForm({
  projectId,
  providerId,
  engagement,
  onDone,
}: {
  projectId: string;
  providerId: string;
  engagement?: ProviderEngagement;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const createEngagement = useCreateEngagement(projectId, providerId);
  const updateEngagement = useUpdateEngagement(projectId, providerId);
  const isEdit = Boolean(engagement);

  const [selectedTypes, setSelectedTypes] = useState<Set<ProviderRequirementType>>(
    () => new Set(engagement?.requirements.map((requirement) => requirement.type) ?? []),
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateProviderEngagementInput>({
    resolver: zodResolver(createProviderEngagementSchema),
    defaultValues: {
      status: engagement?.status ?? 'solicitada',
      quotedAmount: engagement?.quotedAmount,
      advanceAmount: engagement?.advanceAmount,
      estimatedStartDate: engagement?.estimatedStartDate,
      notes: engagement?.notes,
      requirements: [],
    },
  });

  function toggleType(type: ProviderRequirementType) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function buildRequirements() {
    return [...selectedTypes].map((type) => {
      const existing = engagement?.requirements.find((requirement) => requirement.type === type);
      return { type, met: existing?.met ?? false, detail: existing?.detail };
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) => {
        const payload = { ...values, requirements: buildRequirements() };
        if (engagement) {
          updateEngagement.mutate(
            { engagementId: engagement.id, payload },
            { onSuccess: onDone },
          );
        } else {
          createEngagement.mutate(payload, { onSuccess: onDone });
        }
      })}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="engagement-status">{t('engagement.fields.status')}</Label>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="engagement-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENGAGEMENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t(`engagement.status.${status}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="engagement-quoted">{t('engagement.fields.quotedAmount')}</Label>
          <Input
            id="engagement-quoted"
            inputMode="decimal"
            {...register('quotedAmount', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
          />
          {errors.quotedAmount && (
            <p className="text-sm text-destructive">{errors.quotedAmount.message}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="engagement-advance">{t('engagement.fields.advanceAmount')}</Label>
          <Input
            id="engagement-advance"
            inputMode="decimal"
            {...register('advanceAmount', {
              setValueAs: (value) => (value === '' ? undefined : Number(value)),
            })}
          />
          {errors.advanceAmount && (
            <p className="text-sm text-destructive">{errors.advanceAmount.message}</p>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t('engagement.fields.amountsHint')}</p>

      <div className="flex flex-col gap-2">
        <Label htmlFor="engagement-start">{t('engagement.fields.estimatedStartDate')}</Label>
        <Input id="engagement-start" type="date" {...register('estimatedStartDate')} />
        {errors.estimatedStartDate && (
          <p className="text-sm text-destructive">{errors.estimatedStartDate.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t('engagement.fields.requirements')}</Label>
        <div className="flex flex-col gap-2 rounded-md border border-input p-3">
          {STANDARD_REQUIREMENTS.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm">
              <Checkbox checked={selectedTypes.has(type)} onCheckedChange={() => toggleType(type)} />
              {t(`engagement.requirement.${type}`)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="engagement-notes">{t('engagement.fields.notes')}</Label>
        <Textarea id="engagement-notes" rows={2} {...register('notes')} />
      </div>

      {/* Este pie no lo pone `FormDrawer`: el panel alterna lista y formulario,
          así que la acción viaja con el formulario, no con el drawer. */}
      <div className="flex justify-end border-t border-border pt-4">
        <Button type="submit" disabled={createEngagement.isPending || updateEngagement.isPending}>
          {isEdit ? t('common.save') : t('engagement.createSubmit')}
        </Button>
      </div>
    </form>
  );
}

/** Una contratación ya creada: montos, fecha y la checklist que se tilda en obra. */
function EngagementCard({
  projectId,
  providerId,
  engagement,
  currency,
  isOwner,
  onEdit,
}: {
  projectId: string;
  providerId: string;
  engagement: ProviderEngagement;
  currency: string;
  isOwner: boolean;
  onEdit: () => void;
}) {
  const { t, i18n } = useTranslation();
  const setRequirementMet = useSetRequirementMet(projectId, providerId);
  const deleteEngagement = useDeleteEngagement(projectId, providerId);

  const pending = engagement.requirements.filter((requirement) => !requirement.met).length;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={statusVariant(engagement.status)}>
          {t(`engagement.status.${engagement.status}`)}
        </Badge>
        {isOwner && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={onEdit}
              aria-label={t('engagement.edit')}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => deleteEngagement.mutate(engagement.id)}
              aria-label={t('engagement.delete')}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-muted-foreground">{t('engagement.fields.quotedAmount')}</dt>
          <dd>
            {engagement.quotedAmount === undefined
              ? '—'
              : formatMoney(engagement.quotedAmount, currency, i18n.language)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('engagement.fields.advanceAmount')}</dt>
          <dd>
            {engagement.advanceAmount === undefined
              ? '—'
              : formatMoney(engagement.advanceAmount, currency, i18n.language)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('engagement.fields.estimatedStartDate')}</dt>
          <dd>{engagement.estimatedStartDate ?? '—'}</dd>
        </div>
      </dl>

      {engagement.requirements.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-sm font-medium">
            {pending === 0
              ? t('engagement.requirementsReady')
              : t('engagement.requirementsPending', { count: pending })}
          </p>
          {engagement.requirements.map((requirement) => (
            <label key={requirement.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={requirement.met}
                onCheckedChange={(next) =>
                  setRequirementMet.mutate({
                    engagementId: engagement.id,
                    requirementId: requirement.id,
                    met: next === true,
                  })
                }
              />
              {requirement.detail ?? t(`engagement.requirement.${requirement.type}`)}
            </label>
          ))}
        </div>
      )}

      {engagement.notes && (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          {engagement.notes}
        </p>
      )}
    </div>
  );
}

export function ProviderEngagementDialog({
  projectId,
  provider,
  currency,
  isOwner,
  open,
  onOpenChange,
}: {
  projectId: string;
  provider: Provider;
  currency: string;
  isOwner: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const [formFor, setFormFor] = useState<ProviderEngagement | 'new' | null>(null);
  const { data } = useProviderEngagements(projectId, open ? provider.id : undefined);

  const engagements = data?.engagements ?? [];

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setFormFor(null);
      }}
      title={t('engagement.title', { name: provider.name })}
      size="md"
    >
        {formFor ? (
          <EngagementForm
            projectId={projectId}
            providerId={provider.id}
            engagement={formFor === 'new' ? undefined : formFor}
            onDone={() => setFormFor(null)}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {engagements.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('engagement.empty')}</p>
            ) : (
              engagements.map((engagement) => (
                <EngagementCard
                  key={engagement.id}
                  projectId={projectId}
                  providerId={provider.id}
                  engagement={engagement}
                  currency={currency}
                  isOwner={isOwner}
                  onEdit={() => setFormFor(engagement)}
                />
              ))
            )}

            {isOwner && (
              <Button type="button" variant="outline" onClick={() => setFormFor('new')}>
                <Plus className="size-4" />
                {t('engagement.new')}
              </Button>
            )}
          </div>
        )}
    </FormDrawer>
  );
}

export default ProviderEngagementDialog;
