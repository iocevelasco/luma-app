import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { Check, Copy } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  bolivaresPaymentSchema,
  type BolivaresPaymentInput,
  type BolivaresPaymentMethod,
  type BolivaresQuote,
} from '@luma/shared';
import { FormDrawer } from '@/components/common/form-drawer';
import { LoadingIndicator } from '@/components/common/loading-indicator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  useBolivaresQuote,
  usePayInBolivares,
} from '@/hooks/subscription/use-subscription-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { errorMessage } from '@/lib/error-message';
import { formatBolivares } from '@/lib/format-money';
import { fromDayKey } from '@/lib/day-key';

const RECEIPT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

type FormValues = Omit<BolivaresPaymentInput, 'activateNow' | 'includeNextProject'>;

/** Un dato para copiar y pegar en la app del banco. */
function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const canCopy = typeof navigator.clipboard?.writeText === 'function';

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-mono">{value}</span>
        {canCopy && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label={t('subscription.bolivares.copy')}
            onClick={() => {
              void navigator.clipboard.writeText(value).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        )}
      </span>
    </div>
  );
}

function QuoteSummary({ quote }: { quote: BolivaresQuote }) {
  const { t, i18n } = useTranslation();
  const dateLocale = useDateLocale();

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-border bg-background px-4 py-3">
        <p className="text-xs text-muted-foreground">{t('subscription.bolivares.amount')}</p>
        <p className="font-mono text-2xl">{formatBolivares(quote.amountBs, i18n.language)}</p>
        <p className="text-xs text-muted-foreground">
          {t('subscription.bolivares.usd', { amount: quote.quote.totalUsd })} ·{' '}
          {t('subscription.bolivares.rate', {
            rate: quote.rate.usd.toLocaleString(i18n.language, { maximumFractionDigits: 4 }),
            date: format(fromDayKey(quote.rate.valueDate), 'PP', { locale: dateLocale }),
          })}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{t('subscription.bolivares.accounts')}</p>
        {quote.accounts.pagoMovil && (
          <div className="rounded-2xl border border-border bg-background px-4 py-2">
            <p className="pt-1 text-xs font-medium text-muted-foreground">
              {t('subscription.bolivares.pagoMovil')}
            </p>
            <CopyRow label={t('subscription.bolivares.accountFields.bank')} value={quote.accounts.pagoMovil.bank} />
            <CopyRow label={t('subscription.bolivares.accountFields.phone')} value={quote.accounts.pagoMovil.phone} />
            <CopyRow label={t('subscription.bolivares.accountFields.id')} value={quote.accounts.pagoMovil.id} />
          </div>
        )}
        {quote.accounts.transferencia && (
          <div className="rounded-2xl border border-border bg-background px-4 py-2">
            <p className="pt-1 text-xs font-medium text-muted-foreground">
              {t('subscription.bolivares.transferencia')}
            </p>
            <CopyRow label={t('subscription.bolivares.accountFields.bank')} value={quote.accounts.transferencia.bank} />
            <CopyRow label={t('subscription.bolivares.accountFields.account')} value={quote.accounts.transferencia.account} />
            <CopyRow label={t('subscription.bolivares.accountFields.holder')} value={quote.accounts.transferencia.holder} />
            <CopyRow label={t('subscription.bolivares.accountFields.id')} value={quote.accounts.transferencia.id} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * El pago en bolívares: cuánto (a la tasa BCV de hoy), a dónde, y los datos
 * del pago con su comprobante. Lo revisa un admin.
 *
 * La cotización se pide al abrir y no antes: la tasa cambia todos los días.
 * Lo que se manda como monto es lo que la persona dice haber pagado; el
 * servidor vuelve a cotizar y avisa a quien revisa si no coincide.
 */
export function BolivaresPaymentDrawer({
  open,
  onOpenChange,
  activateNow = false,
  includeNextProject = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pasar a Pro desde hoy, cortando el plan Gratis. */
  activateNow?: boolean;
  /** Para crear la cuarta obra: esa obra entra ya en el cobro. */
  includeNextProject?: boolean;
}) {
  const { t } = useTranslation();
  const quote = useBolivaresQuote(activateNow, includeNextProject, open);
  const pay = usePayInBolivares();
  const [receipt, setReceipt] = useState<File | null>(null);

  const methods: BolivaresPaymentMethod[] = [
    ...(quote.data?.accounts.pagoMovil ? (['pago_movil'] as const) : []),
    ...(quote.data?.accounts.transferencia ? (['transferencia'] as const) : []),
  ];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(bolivaresPaymentSchema.omit({ activateNow: true, includeNextProject: true })),
    defaultValues: { paidOn: format(new Date(), 'yyyy-MM-dd') },
  });

  // Con la cotización a la vista, el monto y el método ya vienen puestos.
  useEffect(() => {
    if (!quote.data) return;
    reset((values) => ({
      ...values,
      amountBs: quote.data.amountBs,
      method: values.method ?? (quote.data.accounts.pagoMovil ? 'pago_movil' : 'transferencia'),
    }));
  }, [quote.data, reset]);

  return (
    <FormDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          pay.reset();
          setReceipt(null);
        }
        onOpenChange(next);
      }}
      title={t(activateNow ? 'subscription.bolivares.titleActivate' : 'subscription.bolivares.title')}
      description={t('subscription.bolivares.description')}
      size="md"
      onSubmit={
        quote.data
          ? handleSubmit((values) =>
              pay.mutate(
                { payload: { ...values, activateNow, includeNextProject }, receipt },
                { onSuccess: () => onOpenChange(false) },
              ),
            )
          : undefined
      }
      submitLabel={t('subscription.bolivares.submit')}
      isSubmitting={pay.isPending}
      error={pay.error}
    >
      {quote.isLoading && <LoadingIndicator />}
      {quote.isError && (
        <p className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          {errorMessage(quote.error, t) ?? t('subscription.bolivares.quoteError')}
        </p>
      )}

      {quote.data && (
        <>
          <QuoteSummary quote={quote.data} />

          <div className="flex flex-col gap-2">
            <Label>{t('subscription.bolivares.fields.method')}</Label>
            <Controller
              control={control}
              name="method"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-4">
                  {methods.map((method) => (
                    <label key={method} className="flex items-center gap-2 text-sm">
                      <RadioGroupItem value={method} />
                      {t(`subscription.method.${method}`)}
                    </label>
                  ))}
                </RadioGroup>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bs-bank">{t('subscription.bolivares.fields.bank')}</Label>
              <Input id="bs-bank" {...register('bank')} aria-invalid={Boolean(errors.bank)} />
              {errors.bank && <p className="text-sm text-destructive">{errors.bank.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bs-reference">{t('subscription.bolivares.fields.reference')}</Label>
              <Input
                id="bs-reference"
                inputMode="numeric"
                {...register('reference')}
                aria-invalid={Boolean(errors.reference)}
              />
              {errors.reference && (
                <p className="text-sm text-destructive">{errors.reference.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bs-payer">{t('subscription.bolivares.fields.payerId')}</Label>
              <Input
                id="bs-payer"
                placeholder="V-12345678"
                {...register('payerId')}
                aria-invalid={Boolean(errors.payerId)}
              />
              {errors.payerId && <p className="text-sm text-destructive">{errors.payerId.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bs-paid-on">{t('subscription.bolivares.fields.paidOn')}</Label>
              <Input
                id="bs-paid-on"
                type="date"
                {...register('paidOn')}
                aria-invalid={Boolean(errors.paidOn)}
              />
              {errors.paidOn && <p className="text-sm text-destructive">{errors.paidOn.message}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bs-amount">{t('subscription.bolivares.fields.amountBs')}</Label>
              <Input
                id="bs-amount"
                type="number"
                step="0.01"
                inputMode="decimal"
                {...register('amountBs', { valueAsNumber: true })}
                aria-invalid={Boolean(errors.amountBs)}
              />
              {errors.amountBs && (
                <p className="text-sm text-destructive">{errors.amountBs.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bs-receipt">{t('subscription.bolivares.fields.receipt')}</Label>
              <Input
                id="bs-receipt"
                type="file"
                accept={RECEIPT_ACCEPT}
                onChange={(event) => setReceipt(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
        </>
      )}
    </FormDrawer>
  );
}
