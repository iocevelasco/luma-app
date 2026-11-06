import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendToDepositSchema, type SendToDepositInput, type StockItem } from '@luma/shared';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSendToDeposit } from '@/hooks/inventory/use-inventory-queries';
import { useMaterials } from '@/hooks/materials/use-material-queries';
import { suggestUnitCost } from '@/lib/inventory-cost';
import { numberField } from '@/lib/parse-decimal';

interface SendToDepositDrawerProps {
  projectId: string;
  /** Moneda de la obra: el costo de referencia viaja en ella. */
  currency: string;
  item: StockItem | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * Mandar material sobrante de la obra al Depósito General de la Empresa. El
 * costo unitario es de referencia —alimenta el «ahorro por reutilización»—: se
 * sugiere con el costo estimado de la compra y la persona lo confirma.
 */
export function SendToDepositDrawer({
  projectId,
  currency,
  item,
  onOpenChange,
}: SendToDepositDrawerProps) {
  const { t } = useTranslation();
  const send = useSendToDeposit(projectId);
  const { data: materialsData } = useMaterials(projectId);

  const suggestedCost = item ? suggestUnitCost(materialsData?.materials ?? [], item.itemKey) : undefined;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SendToDepositInput>({
    resolver: zodResolver(sendToDepositSchema),
    defaultValues: { itemKey: '', quantity: undefined as unknown as number, unitCost: 0 },
  });

  // Se carga al elegir el material y cuando llega el costo sugerido, pero sin
  // pisar lo que la persona ya escribió (`keepDirtyValues`). Con `values:` el
  // formulario se reiniciaba entero cada vez que cambiaba la sugerencia. La
  // cantidad arranca vacía a propósito: no hay deshacer, y mandar todo el stock
  // no puede ser lo que pasa con un toque sin mirar.
  useEffect(() => {
    reset(
      {
        itemKey: item?.itemKey ?? '',
        quantity: undefined as unknown as number,
        unitCost: suggestedCost ?? 0,
      },
      { keepDirtyValues: true },
    );
  }, [item?.itemKey, suggestedCost, reset]);

  function close() {
    send.reset();
    onOpenChange(false);
    reset();
  }

  return (
    <FormDrawer
      open={item !== null}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={t('inventory.deposit.sendTitle', { name: item?.name ?? '' })}
      description={t('inventory.deposit.sendHint')}
      fieldCount={3}
      submitLabel={t('inventory.deposit.sendSubmit')}
      isSubmitting={send.isPending}
      error={send.error}
      onSubmit={handleSubmit((values) =>
        send.mutate({ ...values, note: values.note || undefined }, { onSuccess: close }),
      )}
    >
      {/*
        Una columna: en un panel angosto el rótulo «Costo unitario de referencia» ocupa
        dos líneas (más en pt) y empuja su campo hacia abajo del de al lado.
      */}
      <div className="grid gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-quantity">{t('inventory.movement.quantity')}</Label>
          <Input
            id="deposit-quantity"
            inputMode="decimal"
            aria-invalid={Boolean(errors.quantity)}
            {...register('quantity', { setValueAs: numberField(undefined) })}
          />
          {item && (
            <p className="text-xs text-muted-foreground">
              {t('inventory.movement.available', {
                quantity: item.stock,
                unit: t(`material.unit.${item.unit}`),
              })}
            </p>
          )}
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-unit-cost">
            {t('inventory.deposit.unitCost', { currency })}
          </Label>
          <Input
            id="deposit-unit-cost"
            inputMode="decimal"
            aria-invalid={Boolean(errors.unitCost)}
            {...register('unitCost', { setValueAs: numberField(0) })}
          />
          <p className="text-xs text-muted-foreground">{t('inventory.deposit.unitCostHint')}</p>
          {errors.unitCost && <p className="text-sm text-destructive">{errors.unitCost.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="deposit-note">{t('inventory.movement.note')}</Label>
          <Textarea id="deposit-note" rows={2} {...register('note')} />
        </div>
      </div>
    </FormDrawer>
  );
}
