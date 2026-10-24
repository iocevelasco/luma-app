import { useEffect, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMaterialInvoiceSchema,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  type CreateMaterialInvoiceInput,
  type MaterialItem,
} from '@luma/shared';
import { Upload } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toDayKey } from '@/components/common/date-range-filter';
import { FormShell } from '@/components/common/form-shell';
import { ProviderCombobox } from '@/components/materials/provider-combobox';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useCreateMaterialInvoice } from '@/hooks/materials/use-material-queries';
import { useProviders } from '@/hooks/providers/use-provider-queries';
import { supplierName } from '@/lib/materials';
import { formatFileSize } from '@/lib/utils';

interface MaterialInvoiceDialogProps {
  projectId: string;
  projectCurrency: string;
  /** Los materiales que paga. Ninguno Pendiente: la UI no ofrece la acción. */
  materials: MaterialItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

/** El proveedor si todos comparten el mismo vinculado; si no, ninguno. */
function sharedProviderId(materials: MaterialItem[]): string | null {
  const first = materials[0]?.providerId ?? null;
  return first && materials.every((material) => material.providerId === first) ? first : null;
}

/**
 * Cargar la factura de una compra desde Compras. Es un gasto —lo dice el
 * modelo, no sólo esta pantalla—: se ve en Finanzas con los mismos campos, y
 * por eso usa las mismas etiquetas que el alta de gasto.
 *
 * La moneda y la cotización quedan congeladas con la factura (regla 2 de
 * Plata). La cotización sólo se pide si la moneda no es la de la obra.
 */
export function MaterialInvoiceDialog({
  projectId,
  projectCurrency,
  materials,
  open,
  onOpenChange,
  onCreated,
}: MaterialInvoiceDialogProps) {
  const { t } = useTranslation();
  const createInvoice = useCreateMaterialInvoice(projectId);
  const { data: providersData } = useProviders(open ? projectId : undefined);
  const [receipt, setReceipt] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requested = materials.filter((material) => material.status === 'solicitado');

  const form = useForm<CreateMaterialInvoiceInput>({
    resolver: zodResolver(createMaterialInvoiceSchema),
  });

  // Cada apertura arranca con lo que ya se sabe de la compra.
  useEffect(() => {
    if (!open) return;
    createInvoice.reset();
    setReceipt(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    const providerId = sharedProviderId(materials);
    const provider = providerId ? supplierName(materials[0]!) : null;
    form.reset({
      materialIds: materials.map((material) => material.id),
      currency: projectCurrency,
      exchangeRate: 1,
      spentOn: toDayKey(new Date()),
      providerId: providerId ?? undefined,
      description: provider
        ? t('material.invoice.defaultDescriptionFrom', { provider })
        : t('material.invoice.defaultDescription', { count: materials.length }),
      markBought: requested.length > 0,
    } as CreateMaterialInvoiceInput);
    // Sólo al abrir: re-sembrar con cada cambio pisaría lo que se tipeó.
  }, [open]);

  const currency = useWatch({ control: form.control, name: 'currency' });
  const providerId = useWatch({ control: form.control, name: 'providerId' }) ?? null;
  const markBought = useWatch({ control: form.control, name: 'markBought' });
  const needsRate = Boolean(currency) && currency?.toUpperCase() !== projectCurrency.toUpperCase();
  const errors = form.formState.errors;

  function handleFile(selected: File | null) {
    setFileError(null);
    if (!selected) return setReceipt(null);
    // Se valida acá además de en la API: subir 20MB para que el servidor diga
    // que no es desperdiciar la conexión de alguien que está en la obra.
    if (!DOCUMENT_MIME_TYPES.includes(selected.type)) {
      setReceipt(null);
      return setFileError(t('finance.errors.receiptType'));
    }
    if (selected.size > DOCUMENT_MAX_BYTES) {
      setReceipt(null);
      return setFileError(t('finance.errors.receiptSize'));
    }
    setReceipt(selected);
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('material.invoice.title', { count: materials.length })}
    >
      <FormShell
        variant="embedded"
        submitLabel={t('material.invoice.submit')}
        onCancel={() => onOpenChange(false)}
        cancelLabel={t('common.cancel')}
        isSubmitting={createInvoice.isPending}
        error={createInvoice.error}
        onSubmit={form.handleSubmit((values) => {
          if (!receipt) {
            setFileError(t('material.invoice.fileRequired'));
            return;
          }
          createInvoice.mutate(
            { payload: values, receipt },
            {
              onSuccess: () => {
                onCreated?.();
                onOpenChange(false);
              },
            },
          );
        })}
      >
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="invoice-file">{t('material.invoice.file')}</Label>
            <input
              ref={fileInputRef}
              id="invoice-file"
              type="file"
              accept={DOCUMENT_MIME_TYPES.join(',')}
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full min-w-0 justify-start font-normal"
              aria-invalid={Boolean(fileError)}
            >
              <Upload className="size-4" />
              <span className="min-w-0 truncate">{receipt ? receipt.name : t('material.invoice.filePlaceholder')}</span>
            </Button>
            {receipt && <p className="text-xs text-muted-foreground">{formatFileSize(receipt.size)}</p>}
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-amount">{t('finance.fields.amount')}</Label>
              <Input
                id="invoice-amount"
                inputMode="decimal"
                aria-invalid={Boolean(errors.amount)}
                {...form.register('amount', { valueAsNumber: true })}
              />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-currency">{t('finance.fields.currency')}</Label>
              <Input id="invoice-currency" maxLength={3} className="uppercase" {...form.register('currency')} />
            </div>
          </div>

          {/* Sólo cuando hace falta: pedir un "1" en el caso normal es un campo que todos completan mal. */}
          {needsRate && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-rate">
                {t('finance.fields.exchangeRate', { from: currency, to: projectCurrency })}
              </Label>
              <Input
                id="invoice-rate"
                inputMode="decimal"
                {...form.register('exchangeRate', { valueAsNumber: true })}
              />
              <p className="text-2xs text-muted-foreground">{t('finance.fields.exchangeRateHint')}</p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-date">{t('material.invoice.date')}</Label>
              <Input id="invoice-date" type="date" {...form.register('spentOn')} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-provider">{t('finance.fields.provider')}</Label>
              <ProviderCombobox
                id="invoice-provider"
                providers={providersData?.providers ?? []}
                allowFreeText={false}
                value={{ providerId, supplier: '' }}
                onChange={(next) =>
                  form.setValue('providerId', next.providerId ?? undefined, { shouldDirty: true })
                }
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="invoice-description">{t('finance.fields.description')}</Label>
            <Input
              id="invoice-description"
              aria-invalid={Boolean(errors.description)}
              {...form.register('description')}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          {/*
            Una factura dice que la compra se hizo. Lo Solicitado se ofrece
            pasarlo a Comprado acá mismo: sin esto, la API la rechaza y hay
            que ir a moverlos uno por uno antes.
          */}
          {requested.length > 0 && (
            <label className="flex items-start gap-3 rounded-md border border-border p-3 text-sm">
              <Checkbox
                id="invoice-mark-bought"
                checked={markBought}
                onCheckedChange={(checked) => form.setValue('markBought', checked === true)}
                className="mt-0.5"
              />
              <span>{t('material.invoice.markBought', { count: requested.length })}</span>
            </label>
          )}
        </div>
      </FormShell>
    </ResponsiveDialog>
  );
}
