import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CreditCard, ExternalLink, Landmark, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  ChargeQuote,
  SubscriptionOverview,
  SubscriptionPaymentSummary,
  SubscriptionStatus,
} from '@luma/shared';
import { PageLayout } from '@/components/layout/page-layout';
import { BolivaresPaymentDrawer } from '@/components/subscription/bolivares-payment-drawer';
import { PaymentStatusBadge } from '@/components/subscription/payment-status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useInvalidateSubscription,
  useMySubscription,
  useStripeCheckout,
  useStripePortal,
  useSubscriptionPayments,
} from '@/hooks/subscription/use-subscription-queries';
import { useDateLocale } from '@/hooks/use-date-locale';
import { formatBolivares, formatMoney } from '@/lib/format-money';
import { hasLiveCard } from '@/lib/subscription';
import { cn } from '@/lib/utils';

const STATUS_CLASSES: Partial<Record<SubscriptionStatus, string>> = {
  activa: 'bg-success text-success-foreground',
  prueba: 'bg-info text-info-foreground',
  en_revision: 'bg-warning text-warning-foreground',
  pago_fallido: 'bg-warning text-warning-foreground',
  vencida: 'bg-destructive text-destructive-foreground',
};

/** Cuánto esperar el webhook de Stripe después de volver del pago. */
const STRIPE_RETURN_POLL_MS = 30_000;

function useFormatDate() {
  const locale = useDateLocale();
  return (iso: string | null) => (iso ? format(new Date(iso), 'PP', { locale }) : '—');
}

function StatusCard({
  subscription,
  hasPendingPayment,
}: {
  subscription: SubscriptionOverview;
  hasPendingPayment: boolean;
}) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const extras = Math.max(0, subscription.activeProjects - subscription.includedProjects);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{t('subscription.statusTitle')}</CardTitle>
        <Badge className={STATUS_CLASSES[subscription.status]}>
          {t(`subscription.status.${subscription.status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          {t(`subscription.statusDetail.${subscription.status}`, {
            count: subscription.trialDaysLeft ?? 0,
            date: formatDate(subscription.accessUntil),
          })}
        </p>
        {/*
          En la prueba el estado sigue siendo "mes gratis" aunque haya un pago
          mandado (la prueba gana): sin esta línea parecía que no había pasado nada.
        */}
        {hasPendingPayment && subscription.status !== 'en_revision' && (
          <p>{t('subscription.pendingPayment')}</p>
        )}
        {subscription.status !== 'sin_iniciar' && (
          <p className="text-muted-foreground">
            {t('subscription.projects', {
              active: subscription.activeProjects,
              included: subscription.includedProjects,
            })}
            {extras > 0 && ` · ${t('subscription.extraProjects', { count: extras })}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function NextChargeCard({ charge, auto }: { charge: ChargeQuote; auto: boolean }) {
  const { t, i18n } = useTranslation();
  const formatDate = useFormatDate();
  const usd = (amount: number) => formatMoney(amount, 'USD', i18n.language);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('subscription.nextCharge.title')}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t('subscription.nextCharge.from', { date: formatDate(charge.periodStart) })}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-1 text-sm">
        {charge.lines.map((line, index) => (
          <div key={index} className="flex justify-between gap-3">
            <span>
              {t(`subscription.nextCharge.lines.${line.kind}`, {
                count: line.kind === 'prorrateo' ? (line.days ?? 0) : line.quantity,
              })}
            </span>
            <span className="font-mono">{usd(line.amountUsd)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between gap-3 border-t border-border pt-2 font-medium">
          <span>{t('subscription.nextCharge.total')}</span>
          <span className="font-mono">{usd(charge.totalUsd)}</span>
        </div>
        <p className="mt-2 text-muted-foreground">
          {t(auto ? 'subscription.nextCharge.auto' : 'subscription.nextCharge.manual')}
        </p>
      </CardContent>
    </Card>
  );
}

function PayCard({
  subscription,
  hasPendingPayment,
  onPayInBolivares,
}: {
  subscription: SubscriptionOverview;
  hasPendingPayment: boolean;
  onPayInBolivares: () => void;
}) {
  const { t } = useTranslation();
  const checkout = useStripeCheckout();
  const portal = useStripePortal();
  const liveCard = hasLiveCard(subscription);
  // Con un pago en Bs esperando revisión no se manda otro (la API contesta 409).
  const inReview = subscription.status === 'en_revision' || hasPendingPayment;
  const { card, bolivares } = subscription.paymentOptions;

  const option = (icon: typeof CreditCard, title: string, hint: string, action: React.ReactNode) => {
    const Icon = icon;
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center">
        <Icon className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        {action}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('subscription.pay.title')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {liveCard &&
          option(
            Settings2,
            t('subscription.pay.manageCard'),
            t('subscription.pay.manageCardHint'),
            <Button variant="secondary" onClick={() => portal.mutate()} disabled={portal.isPending}>
              <ExternalLink className="size-4" />
              {t('subscription.pay.manageCard')}
            </Button>,
          )}
        {!liveCard &&
          card &&
          option(
            CreditCard,
            t('subscription.pay.card'),
            t('subscription.pay.cardHint'),
            <Button onClick={() => checkout.mutate(false)} disabled={checkout.isPending || inReview}>
              {t('subscription.pay.card')}
            </Button>,
          )}
        {!liveCard &&
          bolivares &&
          option(
            Landmark,
            t('subscription.pay.bolivares'),
            inReview ? t('subscription.pay.inReview') : t('subscription.pay.bolivaresHint'),
            <Button variant="secondary" onClick={onPayInBolivares} disabled={inReview}>
              {t('subscription.pay.bolivares')}
            </Button>,
          )}
        {!liveCard && !card && !bolivares && (
          <p className="text-sm text-muted-foreground">{t('subscription.pay.none')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryCard({ payments }: { payments: SubscriptionPaymentSummary[] }) {
  const { t, i18n } = useTranslation();
  const formatDate = useFormatDate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('subscription.history.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('subscription.history.empty')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {payments.map((payment) => (
              <li key={payment.id} className="flex flex-col gap-1 py-3 text-sm first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {t(`subscription.method.${payment.method}`)} · {formatDate(payment.submittedAt)}
                  </span>
                  <PaymentStatusBadge status={payment.status} />
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                  <span>
                    {t('subscription.history.period', {
                      from: formatDate(payment.periodStart),
                      to: formatDate(payment.periodEnd),
                    })}
                  </span>
                  <span className="font-mono">
                    {formatMoney(payment.totalUsd, 'USD', i18n.language)}
                    {payment.amountBs != null && ` · ${formatBolivares(payment.amountBs, i18n.language)}`}
                  </span>
                </div>
                {payment.rejectionReason && (
                  <p className="text-destructive">
                    {t('subscription.history.rejected', { reason: payment.rejectionReason })}
                  </p>
                )}
                {payment.receipt?.url && (
                  <a
                    href={payment.receipt.url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-fit text-sm underline decoration-foreground/40 underline-offset-2 hover:decoration-foreground"
                  >
                    {t('subscription.history.receipt')}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Mi suscripción: en qué estado está, cuánto es el próximo cobro, cómo pagar
 * y qué pagué. Todo lo que se muestra viene resuelto de la API; acá no se
 * calcula ni un día ni un dólar.
 *
 * Al volver de Stripe (`?stripe=ok`) el webhook puede tardar unos segundos:
 * la pantalla consulta seguido un rato hasta que se refleja.
 */
export function SubscriptionPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [waitingStripe, setWaitingStripe] = useState(false);
  const [payingInBolivares, setPayingInBolivares] = useState(false);
  const invalidate = useInvalidateSubscription();
  const { data: subscription, isLoading, isError } = useMySubscription({
    pollWhilePending: waitingStripe,
  });
  const { data: payments = [] } = useSubscriptionPayments();
  const hasPendingPayment = payments.some((payment) => payment.status === 'pendiente');

  useEffect(() => {
    const stripe = searchParams.get('stripe');
    if (!stripe) return;
    if (stripe === 'ok') {
      toast.success(t('subscription.stripeReturn.ok'));
      setWaitingStripe(true);
      invalidate();
      window.setTimeout(() => setWaitingStripe(false), STRIPE_RETURN_POLL_MS);
    } else {
      toast(t('subscription.stripeReturn.cancel'));
    }
    setSearchParams({}, { replace: true });
    // Sólo al llegar: el parámetro se consume una vez.
  }, []);

  useEffect(() => {
    if (waitingStripe && hasLiveCard(subscription)) {
      setWaitingStripe(false);
      invalidate();
    }
  }, [waitingStripe, subscription, invalidate]);

  return (
    <>
      <PageLayout width="narrow" isLoading={isLoading} isError={isError}>
        {subscription && (
          <div className={cn('flex flex-col gap-4')}>
            <StatusCard subscription={subscription} hasPendingPayment={hasPendingPayment} />
            {subscription.nextCharge && (
              <NextChargeCard charge={subscription.nextCharge} auto={hasLiveCard(subscription)} />
            )}
            {subscription.status !== 'sin_iniciar' && (
              <PayCard
                subscription={subscription}
                hasPendingPayment={hasPendingPayment}
                onPayInBolivares={() => setPayingInBolivares(true)}
              />
            )}
            <HistoryCard payments={payments} />
          </div>
        )}
      </PageLayout>
      <BolivaresPaymentDrawer open={payingInBolivares} onOpenChange={setPayingInBolivares} />
    </>
  );
}

export default SubscriptionPage;
