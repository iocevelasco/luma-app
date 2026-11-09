import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DOCUMENT_MAX_BYTES, SUBSCRIPTION_RECEIPT_EXTENSIONS } from '@luma/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatFileSize } from '@/lib/utils';

const RECEIPT_MIME_TYPES = Object.keys(SUBSCRIPTION_RECEIPT_EXTENSIONS);

/** El comprobante elegido y su error, para quien arma el envío. */
export function useReceiptField() {
  const { t } = useTranslation();
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pick(selected: File | undefined) {
    if (!selected) return;
    // Se valida acá además de en la API: subir 20MB para que el servidor diga que no es
    // desperdiciar la conexión de alguien que está pagando desde el teléfono.
    const problem = !RECEIPT_MIME_TYPES.includes(selected.type)
      ? t('subscription.bolivares.fields.receiptType')
      : selected.size > DOCUMENT_MAX_BYTES
        ? t('subscription.bolivares.fields.receiptSize')
        : null;
    setReceipt(problem ? null : selected);
    setError(problem);
  }

  // Los paneles siguen montados al cerrarse: lo que no se limpia viaja en el próximo pago.
  function clear() {
    setReceipt(null);
    setError(null);
  }

  return {
    receipt,
    error,
    pick,
    clear,
    markMissing: () => setError(t('subscription.bolivares.fields.receiptRequired')),
  };
}

export function ReceiptField({
  id,
  label,
  field,
}: {
  id: string;
  label: string;
  field: ReturnType<typeof useReceiptField>;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={RECEIPT_MIME_TYPES.join(',')}
        className="sr-only"
        aria-invalid={Boolean(field.error)}
        onChange={(event) => {
          field.pick(event.target.files?.[0]);
          // Vaciado para que volver a elegir el mismo archivo dispare `change`.
          event.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        className="w-full min-w-0 justify-start font-normal"
      >
        <Upload className="size-4" />
        <span className="min-w-0 truncate">
          {field.receipt ? field.receipt.name : t('subscription.bolivares.fields.receiptPlaceholder')}
        </span>
      </Button>
      <p className="text-xs text-muted-foreground">
        {field.receipt ? formatFileSize(field.receipt.size) : t('subscription.bolivares.fields.receiptHint')}
      </p>
      {field.error && <p className="text-sm text-destructive">{field.error}</p>}
    </div>
  );
}
