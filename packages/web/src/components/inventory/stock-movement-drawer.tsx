import { zodResolver } from '@hookform/resolvers/zod';
import {
  createStockMovementSchema,
  MANUAL_STOCK_MOVEMENT_KINDS,
  type CreateStockMovementInput,
  type ManualStockMovementKind,
  type StockItem,
} from '@luma/shared';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
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
import { useAllActivities } from '@/hooks/activities/use-activity-queries';
import { useCreateStockMovement } from '@/hooks/inventory/use-inventory-queries';
import { numberField } from '@/lib/parse-decimal';

/** `Select` no admite un valor vacío: este es el "ninguna" de la tarea. */
const NO_ACTIVITY = '__none__';

/** Con qué tipo y material se abre el drawer: el atajo de una fila. */
export interface StockMovementDrawerInitial {
  kind: ManualStockMovementKind;
  itemKey?: string;
}

interface StockMovementDrawerProps {
  projectId: string;
  items: StockItem[];
  initial?: StockMovementDrawerInitial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * El formulario de despacho: tres campos a la vista (material, cantidad,
 * quién), el resto sólo cuando el tipo lo pide. Pensado para el celular del
 * almacenista: con un material elegido desde la fila son dos toques y un
 * nombre.
 */
export function StockMovementDrawer({
  projectId,
  items,
  initial,
  open,
  onOpenChange,
}: StockMovementDrawerProps) {
  const { t } = useTranslation();
  const create = useCreateStockMovement(projectId);
  const { data: activitiesData } = useAllActivities(projectId);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateStockMovementInput>({
    resolver: zodResolver(createStockMovementSchema),
    values: {
      kind: initial?.kind ?? 'consumo',
      itemKey: initial?.itemKey ?? '',
      quantity: undefined as unknown as number,
      activityId: null,
    },
  });

  const kind = useWatch({ control, name: 'kind' });
  const itemKey = useWatch({ control, name: 'itemKey' });
  const selected = items.find((item) => item.itemKey === itemKey);
  // Salvo una devolución, no se puede sacar más de lo que hay.
  const available = kind !== 'devolucion' && selected ? selected.stock : undefined;

  function close() {
    create.reset();
    onOpenChange(false);
    reset();
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else close();
      }}
      title={t(`inventory.movement.title.${kind}`)}
      fieldCount={7}
      submitLabel={t('inventory.movement.submit')}
      isSubmitting={create.isPending}
      error={create.error}
      onSubmit={handleSubmit((values) => {
        create.mutate(
          {
            ...values,
            activityId: values.activityId || null,
            destination: values.destination || undefined,
            receiver: values.receiver || undefined,
            reason: values.kind === 'merma' ? values.reason || undefined : undefined,
            note: values.note || undefined,
          },
          { onSuccess: close },
        );
      })}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>{t('inventory.movement.kind')}</Label>
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MANUAL_STOCK_MOVEMENT_KINDS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`inventory.kind.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t('inventory.movement.item')}</Label>
          <Controller
            control={control}
            name="itemKey"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-invalid={Boolean(errors.itemKey)}>
                  <SelectValue placeholder={t('inventory.movement.itemPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.itemKey} value={item.itemKey}>
                      {item.name} · {t(`material.unit.${item.unit}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.itemKey && <p className="text-sm text-destructive">{errors.itemKey.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="movement-quantity">{t('inventory.movement.quantity')}</Label>
          <Input
            id="movement-quantity"
            inputMode="decimal"
            aria-invalid={Boolean(errors.quantity)}
            {...register('quantity', { setValueAs: numberField(undefined) })}
          />
          {available !== undefined && (
            <p className="text-xs text-muted-foreground">
              {t('inventory.movement.available', {
                quantity: available,
                unit: t(`material.unit.${selected!.unit}`),
              })}
            </p>
          )}
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="movement-receiver">
            {t(kind === 'merma' ? 'inventory.movement.responsible' : 'inventory.movement.receiver')}
            {kind === 'devolucion' && ` ${t('inventory.movement.optional')}`}
          </Label>
          <Input
            id="movement-receiver"
            aria-invalid={Boolean(errors.receiver)}
            placeholder={t('inventory.movement.receiverPlaceholder')}
            {...register('receiver')}
          />
          {errors.receiver && <p className="text-sm text-destructive">{errors.receiver.message}</p>}
        </div>

        {kind === 'merma' && (
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="movement-reason">{t('inventory.movement.reason')}</Label>
            <Input
              id="movement-reason"
              aria-invalid={Boolean(errors.reason)}
              placeholder={t('inventory.movement.reasonPlaceholder')}
              {...register('reason')}
            />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>{t('inventory.movement.activity')}</Label>
          <Controller
            control={control}
            name="activityId"
            render={({ field }) => (
              <Select
                value={field.value ?? NO_ACTIVITY}
                onValueChange={(value) => field.onChange(value === NO_ACTIVITY ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACTIVITY}>{t('inventory.movement.noActivity')}</SelectItem>
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
          <Label htmlFor="movement-destination">{t('inventory.movement.destination')}</Label>
          <Input
            id="movement-destination"
            placeholder={t('inventory.movement.destinationPlaceholder')}
            {...register('destination')}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="movement-note">{t('inventory.movement.note')}</Label>
          <Textarea id="movement-note" rows={2} {...register('note')} />
        </div>
      </div>
    </FormDrawer>
  );
}
