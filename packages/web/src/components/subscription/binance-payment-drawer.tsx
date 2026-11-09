import { useTranslation } from 'react-i18next';
import type { PlanCode } from '@luma/shared';
import { FormDrawer } from '@/components/common/form-drawer';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { CopyRow } from '@/components/subscription/copy-row';
import { ReceiptField, useReceiptField } from '@/components/subscription/receipt-field';
import { Button } from '@/components/ui/button';
import { useBinanceQuote, usePayWithBinance } from '@/hooks/subscription/use-subscription-queries';
import { errorMessage } from '@/lib/error-message';

/**
 * El pago en USDT por Binance Pay: cuánto, a qué cuenta y el comprobante. El
 * monto y la fecha salen del propio cobro, así que no se le piden a nadie. Lo
 * confirma un admin, y el dueño recibe el recibo por correo.
 */
export function BinancePaymentDrawer({
  open,
  onOpenChange,
  activateNow = false,
  includeNextProject = false,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activateNow?: boolean;
  includeNextProject?: boolean;
  plan?: PlanCode;
}) {
  const { t } = useTranslation();
  const quote = useBinanceQuote(activateNow, includeNextProject, open, plan);
  const pay = usePayWithBinance();
  const receipt = useReceiptField();

  function close() {
    pay.reset();
    receipt.clear();
    onOpenChange(false);
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => (next ? onOpenChange(true) : close())}
      title={t(activateNow ? 'subscription.binance.titleActivate' : 'subscription.binance.title')}
      description={t('subscription.binance.description')}
      size="md"
      onSubmit={
        quote.data
          ? (event) => {
              event.preventDefault();
              if (quote.data?.receiptRequired && !receipt.receipt) {
                receipt.markMissing();
                return;
              }
              pay.mutate(
                { payload: { activateNow, includeNextProject, plan }, receipt: receipt.receipt },
                { onSuccess: close },
              );
            }
          : undefined
      }
      submitLabel={t('subscription.binance.submit')}
      isSubmitting={pay.isPending}
      error={pay.error}
    >
      {quote.isLoading && <LoadingIndicator />}
      {quote.isError && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <p>{errorMessage(quote.error, t) ?? t('subscription.binance.quoteError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void quote.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      )}

      {quote.data && (
        <>
          <div className="rounded-2xl border border-border bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('subscription.binance.amount')}</p>
            <p className="font-mono text-2xl">{quote.data.amountUsdt} USDT</p>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t('subscription.binance.account')}</p>
            <div className="rounded-2xl border border-border bg-background px-4 py-2">
              <CopyRow label={t('subscription.binance.payId')} value={quote.data.account.payId} />
              <CopyRow label={t('subscription.binance.name')} value={quote.data.account.name} />
            </div>
          </div>

          {/* Sin storage en este entorno la API rechaza el archivo: no se ofrece. */}
          {quote.data.receiptRequired && (
            <ReceiptField id="bn-receipt" label={t('subscription.binance.fields.receipt')} field={receipt} />
          )}
        </>
      )}
    </FormDrawer>
  );
}
