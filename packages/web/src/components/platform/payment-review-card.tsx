import { useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Check, FileText, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AdminSubscriptionPayment } from '@luma/shared';
import { FormDrawer } from '@/components/common/form-drawer';
import { PaymentStatusBadge } from '@/components/subscription/payment-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useReviewSubscriptionPayment } from '@/hooks/platform/use-platform-billing-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { errorMessage } from '@/lib/error-message';
import { formatBolivares, formatMoney } from '@/lib/format-money';
import { fromDayKey } from '@/lib/day-key';

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={mono ? 'font-mono text-sm' : 'text-sm'}>{value ?? '—'}</span>
    </div>
  );
}

/**
 * Un pago en bolívares en la cola del admin. Lo que hace falta para decidir
 * sin abrir otra pantalla: de quién es, cuánto se cotizó contra cuánto dice
 * haber pagado, los datos para buscarlo en el banco y el comprobante.
 */
export function PaymentReviewCard({ payment }: { payment: AdminSubscriptionPayment }) {
  const { t, i18n } = useTranslation();
  const locale = useDateLocale();
  const review = useReviewSubscriptionPayment();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const date = (iso: string) => format(new Date(iso), 'PPp', { locale });
  const day = (key: string | null) => (key ? format(fromDayKey(key), 'PP', { locale }) : '—');
  const approveError = review.variables?.decision.decision === 'aprobar' ? review.error : null;

  return (
    // Una fila-tarjeta de la lista de pagos (DESIGN.md, "Listas"): sin borde,
    // con el radio de fila y la misma subida al pasar.
    <Card className="rounded-2xl border-0 transition-shadow duration-200 focus-within:shadow-lift hover:shadow-lift">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{payment.organization.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {payment.owner
              ? t('platform.payments.owner', { name: payment.owner.name, email: payment.owner.email })
              : '—'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {payment.activatesNow && (
            <Badge variant="outline">{t('platform.payments.activateNow')}</Badge>
          )}
          <PaymentStatusBadge status={payment.status} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field
            label={t('platform.payments.quoted')}
            value={payment.amountBs != null ? formatBolivares(payment.amountBs, i18n.language) : '—'}
            mono
          />
          <Field
            label={t('platform.payments.declared')}
            value={
              payment.declaredAmountBs != null
                ? formatBolivares(payment.declaredAmountBs, i18n.language)
                : '—'
            }
            mono
          />
          <Field label="USD" value={formatMoney(payment.totalUsd, 'USD', i18n.language)} mono />
          <Field
            label={t('platform.payments.rate')}
            value={payment.bcvRate?.toLocaleString(i18n.language, { maximumFractionDigits: 8 })}
            mono
          />
          <Field label={t('platform.payments.method')} value={t(`subscription.method.${payment.method}`)} />
          <Field label={t('platform.payments.bank')} value={payment.bank} />
          <Field label={t('platform.payments.reference')} value={payment.reference} mono />
          <Field label={t('platform.payments.payerId')} value={payment.payerId} mono />
          <Field label={t('platform.payments.paidOn')} value={day(payment.paidOn)} />
          <Field label={t('platform.payments.submitted')} value={date(payment.submittedAt)} />
          <Field
            label={t('platform.payments.period')}
            value={`${format(new Date(payment.periodStart), 'PP', { locale })} – ${format(new Date(payment.periodEnd), 'PP', { locale })}`}
          />
        </div>

        {payment.amountMismatch && (
          <p className="flex items-center gap-2 rounded-2xl border border-warning/50 bg-warning/10 px-3 py-2 text-sm">
            <AlertTriangle className="size-4 shrink-0" />
            {t('platform.payments.mismatch')}
          </p>
        )}
        {payment.rejectionReason && (
          <p className="text-sm text-destructive">
            {t('platform.payments.reason', { reason: payment.rejectionReason })}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {payment.receipt?.url ? (
            <Button asChild variant="outline" size="sm">
              <a href={payment.receipt.url} target="_blank" rel="noreferrer">
                <FileText className="size-4" />
                {t('platform.payments.receipt')}
              </a>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">{t('platform.payments.noReceipt')}</span>
          )}

          {payment.status === 'pendiente' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejecting(true)}>
                <X className="size-4" />
                {t('platform.payments.reject')}
              </Button>
              <Button
                size="sm"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({ paymentId: payment.id, decision: { decision: 'aprobar' } })
                }
              >
                <Check className="size-4" />
                {t('platform.payments.approve')}
              </Button>
            </div>
          )}
        </div>
        {approveError && (
          <p className="text-sm text-destructive">{errorMessage(approveError, t)}</p>
        )}
      </CardContent>

      <FormDrawer
        open={rejecting}
        onOpenChange={setRejecting}
        title={t('platform.payments.rejectTitle')}
        size="sm"
        onSubmit={(event) => {
          event.preventDefault();
          review.mutate(
            { paymentId: payment.id, decision: { decision: 'rechazar', reason } },
            { onSuccess: () => setRejecting(false) },
          );
        }}
        submitLabel={t('platform.payments.rejectSubmit')}
        isSubmitting={review.isPending}
        isDirty={reason.trim().length >= 5}
        error={review.variables?.decision.decision === 'rechazar' ? review.error : null}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`reason-${payment.id}`}>{t('platform.payments.rejectReason')}</Label>
          <Textarea
            id={`reason-${payment.id}`}
            value={reason}
            minLength={5}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </FormDrawer>
    </Card>
  );
}
