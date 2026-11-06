import { useState } from 'react';
import { importFromDepositSchema, type DepositLine } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDepositForImport, useImportFromDeposit } from '@/hooks/inventory/use-inventory-queries';
import { formatMoney } from '@/lib/format-money';
import { parseDecimal } from '@/lib/parse-decimal';

interface ImportFromDepositDrawerProps {
  projectId: string;
  /** Moneda de la obra: el flete es un gasto de ella. */
  currency: string;
  /** Quien carga gastos puede imputar el flete; el resto no lo ve. */
  canChargeFreight: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Traer material del Depósito General a esta obra, **a costo $0**: sin
 * factura, sin proveedor, sin cuenta por pagar. Se elige cuánto de cada línea;
 * lo que queda en blanco no se trae. El flete, si lo hubo, es un gasto más de
 * esta obra.
 */
export function ImportFromDepositDrawer({
  projectId,
  currency,
  canChargeFreight,
  open,
  onOpenChange,
}: ImportFromDepositDrawerProps) {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useDepositForImport(projectId, open);
  const importer = useImportFromDeposit(projectId);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [freight, setFreight] = useState('');
  const [freightNote, setFreightNote] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const lines = data?.lines ?? [];

  function close() {
    importer.reset();
    setQuantities({});
    setFreight('');
    setFreightNote('');
    setLocalError(null);
    onOpenChange(false);
  }

  function submit() {
    // Un campo con texto que no es un número se avisa: descartarlo en silencio
    // haría importar menos de lo que la persona cree.
    const picked: { itemKey: string; currency: string; quantity: number }[] = [];
    for (const line of lines) {
      const text = quantities[line.lineKey] ?? '';
      if (text.trim() === '') continue;
      const quantity = parseDecimal(text);
      if (Number.isNaN(quantity)) {
        setLocalError(t('inventory.deposit.invalidQuantity', { name: line.name }));
        return;
      }
      if (quantity > 0) picked.push({ itemKey: line.itemKey, currency: line.currency, quantity });
    }
    const freightAmount = freight.trim() === '' ? 0 : parseDecimal(freight);
    if (Number.isNaN(freightAmount)) {
      setLocalError(t('inventory.deposit.invalidFreight'));
      return;
    }

    const parsed = importFromDepositSchema.safeParse({
      lines: picked,
      freight:
        canChargeFreight && freightAmount > 0
          ? { amount: freightAmount, description: freightNote || undefined }
          : undefined,
    });
    if (!parsed.success) {
      setLocalError(parsed.error.issues[0]?.message ?? t('inventory.deposit.importEmpty'));
      return;
    }
    setLocalError(null);
    importer.mutate(parsed.data, { onSuccess: close });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      title={t('inventory.deposit.importTitle')}
      description={t('inventory.deposit.importHint')}
      size="md"
      submitLabel={t('inventory.deposit.importSubmit')}
      isSubmitting={importer.isPending}
      error={importer.error}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {isLoading ? null : lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('inventory.deposit.importNothing')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <DepositPickRow
              key={line.lineKey}
              line={line}
              locale={i18n.language}
              value={quantities[line.lineKey] ?? ''}
              onChange={(value) => setQuantities((current) => ({ ...current, [line.lineKey]: value }))}
            />
          ))}
        </ul>
      )}

      {canChargeFreight && lines.length > 0 && (
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="freight-amount">{t('inventory.deposit.freight', { currency })}</Label>
            <Input
              id="freight-amount"
              inputMode="decimal"
              value={freight}
              onChange={(event) => setFreight(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('inventory.deposit.freightHint')}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="freight-note">{t('inventory.deposit.freightNote')}</Label>
            <Input
              id="freight-note"
              value={freightNote}
              onChange={(event) => setFreightNote(event.target.value)}
            />
          </div>
        </div>
      )}

      {localError && <p className="text-sm text-destructive">{localError}</p>}
    </FormDrawer>
  );
}

function DepositPickRow({
  line,
  locale,
  value,
  onChange,
}: {
  line: DepositLine;
  locale: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const unit = t(`material.unit.${line.unit}`);
  const inputId = `import-${line.lineKey}`;

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
      <div className="min-w-0 flex-1 basis-40">
        <Label htmlFor={inputId} className="font-medium">
          {line.name}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t('inventory.deposit.lineMeta', {
            stock: line.stock,
            unit,
            cost: line.unitCost > 0 ? formatMoney(line.unitCost, line.currency, locale) : '—',
          })}
        </p>
      </div>
      <Input
        id={inputId}
        inputMode="decimal"
        className="w-28"
        placeholder="0"
        aria-label={t('inventory.deposit.importQuantity', { name: line.name })}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </li>
  );
}
