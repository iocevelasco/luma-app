import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  planConfigSchema,
  publishPlanConfigSchema,
  quoteCharge,
  type PlanCatalog,
  type PlanConfig,
  type PublishPlanConfigInput,
} from '@luma/shared';
import { FormShell } from '@/components/common/form-shell';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePublishPlanConfig } from '@/hooks/platform/use-platform-billing-queries';
import { numberField } from '@/lib/form-fields';
import { formatMoney } from '@/lib/format-money';

type FormValues = Pick<PublishPlanConfigInput, 'config' | 'note'>;

const formSchema = publishPlanConfigSchema.pick({ config: true, note: true });

/** Vacío es "sin tope" o "no se ofrece", no un número que falta. */
const nullableNumberField = {
  setValueAs: (value: unknown) => numberField.setValueAs(value) ?? null,
};

const PREVIEW_PROJECTS = [3, 10, 19, 25, 40];

function previewTotal(config: PlanConfig, count: number): number {
  const projects = Array.from({ length: count }, (_, index) => ({
    id: String(index),
    createdAt: new Date(0),
    archivedAt: null,
  }));
  return quoteCharge({ periodStart: new Date(), projects, config, plan: 'pro', previousPeriod: null }).totalUsd;
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null;
}

/** Cuánto pagaría un cliente nuevo con la lista que se está editando. */
function PlanPreview({ config }: { config: PlanConfig }) {
  const { t, i18n } = useTranslation();
  const usd = (amount: number) => formatMoney(amount, 'USD', i18n.language);

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium">{t('platform.plans.previewTitle')}</p>
        <p className="text-xs text-muted-foreground">{t('platform.plans.previewHint')}</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-muted-foreground">
            <th className="py-1 font-normal">{t('platform.plans.previewProjects')}</th>
            <th className="py-1 text-right font-normal">{t('platform.plans.previewPro')}</th>
            <th className="py-1 text-right font-normal">{t('platform.plans.previewUnlimited')}</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {PREVIEW_PROJECTS.map((count) => (
            <tr key={count}>
              <td className="py-1">{count}</td>
              <td className="py-1 text-right">{usd(previewTotal(config, count))}</td>
              <td className="py-1 text-right">
                {config.unlimitedPriceUsd === null ? '—' : usd(config.unlimitedPriceUsd)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Editar y publicar la lista de precios. Publicar no toca lo ya pagado ni a
 * quien renueva sin cortar: por eso se confirma, diciendo a quién alcanza.
 */
export function PlanConfigForm({ catalog }: { catalog: PlanCatalog }) {
  const { t } = useTranslation();
  const publish = usePublishPlanConfig();
  const [pending, setPending] = useState<FormValues | null>(null);
  const { version, config } = catalog.current;

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { config, note: '' },
  });
  const tiers = useFieldArray({ control, name: 'config.extraTiers' });
  const draft = planConfigSchema.safeParse(useWatch({ control, name: 'config' }));

  // Al publicar llega una versión nueva: el formulario arranca de ella.
  // Depende sólo de `version`: `config` cambia de identidad en cada refetch y borraría lo editado.
  useEffect(() => {
    reset({ config, note: '' });
  }, [version, reset]);

  const lastTier = tiers.fields.length - 1;
  const tierErrors = errors.config?.extraTiers;

  return (
    <>
      {catalog.publishBlocked && (
        <p className="flex items-center gap-2 rounded-2xl border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          {t('platform.plans.publishBlocked')}
        </p>
      )}

      <FormShell
        variant="embedded"
        className="gap-6"
        onSubmit={handleSubmit(setPending)}
        submitLabel={t('platform.plans.submit')}
        isSubmitting={publish.isPending}
        isDirty={isDirty && !catalog.publishBlocked}
        error={publish.error}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-base">{t('platform.plans.basePrice')}</Label>
            <Input id="plan-base" inputMode="decimal" {...register('config.basePriceUsd', numberField)} />
            <FieldError message={errors.config?.basePriceUsd?.message} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-unlimited">{t('platform.plans.unlimitedPrice')}</Label>
            <Input
              id="plan-unlimited"
              inputMode="decimal"
              aria-describedby="plan-unlimited-hint"
              {...register('config.unlimitedPriceUsd', nullableNumberField)}
            />
            <p id="plan-unlimited-hint" className="text-xs text-muted-foreground">
              {t('platform.plans.unlimitedHint')}
            </p>
            <FieldError message={errors.config?.unlimitedPriceUsd?.message} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-included">{t('platform.plans.included')}</Label>
            <Input id="plan-included" inputMode="numeric" {...register('config.includedProjects', numberField)} />
            <FieldError message={errors.config?.includedProjects?.message} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan-trial">{t('platform.plans.trialDays')}</Label>
            <Input id="plan-trial" inputMode="numeric" {...register('config.trialDays', numberField)} />
            <FieldError message={errors.config?.trialDays?.message} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{t('platform.plans.tiersTitle')}</p>
          {tiers.fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-1">
              <div className="grid grid-cols-[1fr_1fr_2.25rem] items-end gap-3">
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor={`tier-up-${index}`}>{t('platform.plans.tierUpTo')}</Label>
                  {index === lastTier ? (
                    <p className="flex h-9 items-center text-sm text-muted-foreground">
                      {t('platform.plans.tierNoCap')}
                    </p>
                  ) : (
                    <Input
                      id={`tier-up-${index}`}
                      inputMode="numeric"
                      {...register(`config.extraTiers.${index}.upToProjects`, nullableNumberField)}
                    />
                  )}
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <Label htmlFor={`tier-price-${index}`}>{t('platform.plans.tierPrice')}</Label>
                  <Input
                    id={`tier-price-${index}`}
                    inputMode="decimal"
                    {...register(`config.extraTiers.${index}.unitUsd`, numberField)}
                  />
                </div>
                {index !== lastTier && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('platform.plans.removeTier')}
                    onClick={() => tiers.remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
              <FieldError
                message={
                  tierErrors?.[index]?.message ??
                  tierErrors?.[index]?.upToProjects?.message ??
                  tierErrors?.[index]?.unitUsd?.message
                }
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              // El último escalón es el que no tiene tope: los nuevos van antes.
              tiers.insert(lastTier, {
                upToProjects: null,
                unitUsd: getValues(`config.extraTiers.${lastTier}.unitUsd`),
              })
            }
          >
            <Plus className="size-4" />
            {t('platform.plans.addTier')}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="plan-note">{t('platform.plans.note')}</Label>
          <Input id="plan-note" maxLength={200} {...register('note')} />
        </div>

        {draft.success && <PlanPreview config={draft.data} />}
      </FormShell>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('platform.plans.confirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('platform.plans.confirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('platform.plans.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) publish.mutate({ ...pending, expectedVersion: version });
                setPending(null);
              }}
            >
              {t('platform.plans.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
