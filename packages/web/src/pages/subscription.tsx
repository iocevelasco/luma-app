import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CreditCard, ReceiptText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { toast } from '@/lib/toast';
import type {
  ChargeQuote,
  PlanCode,
  SubscriptionOverview,
  SubscriptionPaymentSummary,
  SubscriptionStatus,
} from '@luma/shared';
import { PageLayout } from '@/components/layout/page-layout';
import { BinancePaymentDrawer } from '@/components/subscription/binance-payment-drawer';
import { BolivaresPaymentDrawer } from '@/components/subscription/bolivares-payment-drawer';
import { useCardCheckout } from '@/components/subscription/card-checkout-dialog';
import { CheckoutDrawer } from '@/components/subscription/checkout-drawer';
import { PlanCards } from '@/components/subscription/plan-cards';
import { PaymentStatusBadge } from '@/components/subscription/payment-status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RowCard, RowCardList } from '@/components/common/row-card-list';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useInvalidateSubscription,
  useMySubscription,
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
  ilimitado: 'bg-primary text-primary-foreground',
};

/** Cuánto esperar el webhook de Stripe después de volver del pago. */
const STRIPE_RETURN_POLL_MS = 30_000;

function useFormatDate() {
  const locale = useDateLocale();
  return (iso: string | null) => (iso ? format(new Date(iso), 'PP', { locale }) : '—');
}

/** En móvil las dos tarjetas del resumen se leen como una sola; desde `md`, lado a lado. */
const SUMMARY_TOP = 'max-md:rounded-b-none max-md:shadow-none';
const SUMMARY_BOTTOM = 'max-md:rounded-t-none max-md:border-t max-md:border-border max-md:shadow-none';

function StatusCard({
  subscription,
  hasPendingPayment,
  className,
}: {
  subscription: SubscriptionOverview;
  hasPendingPayment: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const extras = Math.max(0, subscription.activeProjects - subscription.includedProjects);
  // El plan pago Ilimitado es una `activa` más; la cortesía tiene su propio estado.
  const paidUnlimited = subscription.status === 'activa' && subscription.plan === 'unlimited';

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">{t('subscription.statusTitle')}</CardTitle>
        <Badge className={STATUS_CLASSES[subscription.status]}>
          {t(paidUnlimited ? 'subscription.status.unlimitedPlan' : `subscription.status.${subscription.status}`)}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <p>
          {t(paidUnlimited ? 'subscription.statusDetail.activaUnlimited' : `subscription.statusDetail.${subscription.status}`, {
            count: subscription.trialDaysLeft ?? 0,
            date: formatDate(subscription.accessUntil),
            included: subscription.includedProjects,
          })}
        </p>
        {/*
          En la prueba el estado sigue siendo "mes gratis" aunque haya un pago
          mandado (la prueba gana): sin esta línea parecía que no había pasado nada.
        */}
        {hasPendingPayment && subscription.status !== 'en_revision' && (
          <p>{t('subscription.pendingPayment')}</p>
        )}
        {subscription.status === 'ilimitado' || paidUnlimited ? (
          <p className="text-muted-foreground">
            {t('subscription.unlimitedProjects', { active: subscription.activeProjects })}
          </p>
        ) : (
          subscription.status !== 'sin_iniciar' && (
            <p className="text-muted-foreground">
              {t('subscription.projects', {
                active: subscription.activeProjects,
                included: subscription.includedProjects,
              })}
              {extras > 0 && ` · ${t('subscription.extraProjects', { count: extras })}`}
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}

function NextChargeCard({
  charge,
  auto,
  includedProjects,
  className,
}: {
  charge: ChargeQuote;
  auto: boolean;
  includedProjects: number;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const formatDate = useFormatDate();
  const usd = (amount: number) => formatMoney(amount, 'USD', i18n.language);

  return (
    <Card className={className}>
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
                included: includedProjects,
                price: usd(line.unitUsd),
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

function PaymentHistory({ payments }: { payments: SubscriptionPaymentSummary[] }) {
  const { t, i18n } = useTranslation();
  const formatDate = useFormatDate();

  if (payments.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('subscription.history.empty')}</p>;
  }

  return (
    <RowCardList>
      {payments.map((payment) => (
        <RowCard key={payment.id} className="flex-col items-stretch gap-1">
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
              {payment.declaredAmountUsdt != null && ` · ${payment.declaredAmountUsdt} USDT`}
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
        </RowCard>
      ))}
    </RowCardList>
  );
}

/**
 * Mi suscripción: en qué estado está, cuánto es el próximo cobro, cómo pagar
 * y qué pagué. Todo lo que se muestra viene resuelto de la API; acá no se
 * calcula ni un día ni un dólar.
 *
 * Después de pagar con tarjeta —en el modal, o al volver de la página de
 * Stripe con `?stripe=ok`— el webhook puede tardar unos segundos: la pantalla
 * consulta seguido un rato hasta que se refleja.
 */
export function SubscriptionPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('tab') === 'pagos' ? 'payments' : 'plan';
  const [waitingStripe, setWaitingStripe] = useState(false);
  // `null` = cerrado; si no, con qué modo se abre el pago en Bs.
  const [bolivaresMode, setBolivaresMode] = useState<{ activateNow: boolean; plan?: PlanCode } | null>(
    null,
  );
  const [binanceMode, setBinanceMode] = useState<{ activateNow: boolean; plan?: PlanCode } | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<PlanCode | null>(null);
  const portal = useStripePortal();
  const invalidate = useInvalidateSubscription();
  const { data: subscription, isLoading, isError } = useMySubscription({
    pollWhilePending: waitingStripe,
  });
  const { data: payments = [] } = useSubscriptionPayments();
  const hasPendingPayment = payments.some((payment) => payment.status === 'pendiente');

  const waitForStripe = () => {
    toast.success(t('subscription.stripeReturn.ok'));
    setWaitingStripe(true);
    invalidate();
    window.setTimeout(() => setWaitingStripe(false), STRIPE_RETURN_POLL_MS);
  };
  const cardCheckout = useCardCheckout({ onComplete: waitForStripe });
  const cardPayment = { start: cardCheckout.start, isPending: cardCheckout.isPending };

  useEffect(() => {
    const stripe = searchParams.get('stripe');
    if (!stripe) return;
    if (stripe === 'ok') {
      waitForStripe();
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

  const upgrading =
    subscription?.status === 'prueba' && !hasLiveCard(subscription) && !hasPendingPayment;
  const inReview = subscription?.status === 'en_revision' || hasPendingPayment;
  const showPlans =
    subscription !== undefined &&
    subscription.status !== 'ilimitado' &&
    subscription.status !== 'sin_iniciar';

  return (
    <>
      <PageLayout
        width="full"
        // Aprovecha la pantalla, con un tope para que en un monitor enorme no se estire de más.
        className="mx-auto max-w-[100rem]"
        isLoading={isLoading}
        isError={isError}
        toolbar={
          <Tabs
            value={view}
            onValueChange={(value) =>
              setSearchParams(value === 'payments' ? { tab: 'pagos' } : {}, { replace: true })
            }
          >
            <TabsList>
              <TabsTrigger value="plan" icon={CreditCard}>
                {t('subscription.history.planTab')}
              </TabsTrigger>
              <TabsTrigger value="payments" icon={ReceiptText}>
                {t('subscription.history.title')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        {subscription && (
          <div className={cn('flex flex-col gap-4')}>
            {view === 'payments' ? (
              <PaymentHistory payments={payments} />
            ) : (
              <>
                <div className={cn('grid', subscription.nextCharge && 'md:grid-cols-2 md:gap-4')}>
                  <StatusCard
                    subscription={subscription}
                    hasPendingPayment={hasPendingPayment}
                    className={subscription.nextCharge ? SUMMARY_TOP : undefined}
                  />
                  {subscription.nextCharge && (
                    <NextChargeCard
                      charge={subscription.nextCharge}
                      auto={hasLiveCard(subscription)}
                      includedProjects={subscription.includedProjects}
                      className={SUMMARY_BOTTOM}
                    />
                  )}
                </div>
                {showPlans && (
                  <section className="flex flex-col gap-4">
                    <h2 className="text-center font-mono text-base">{t('subscription.plans.title')}</h2>
                    {inReview && (
                      <p className="text-center text-sm text-muted-foreground">
                        {t('subscription.pay.inReview')}
                      </p>
                    )}
                    <PlanCards
                      subscription={subscription}
                      upgrading={upgrading}
                      inReview={inReview}
                      onChoose={setCheckoutPlan}
                      onManageCard={() => portal.open()}
                      managePending={portal.isPending}
                    />
                  </section>
                )}
              </>
            )}
          </div>
        )}
      </PageLayout>
      {subscription && (
        <CheckoutDrawer
          plan={checkoutPlan}
          onClose={() => setCheckoutPlan(null)}
          subscription={subscription}
          upgrading={upgrading}
          cardPending={cardPayment.isPending}
          onPayCard={({ activateNow }) => {
            setCheckoutPlan(null);
            cardPayment.start({ activateNow });
          }}
          onPayBolivares={(choice) => {
            setCheckoutPlan(null);
            setBolivaresMode(choice);
          }}
          onPayBinance={(choice) => {
            setCheckoutPlan(null);
            setBinanceMode(choice);
          }}
        />
      )}
      <BolivaresPaymentDrawer
        open={bolivaresMode !== null}
        onOpenChange={(open) => !open && setBolivaresMode(null)}
        activateNow={bolivaresMode?.activateNow ?? false}
        plan={bolivaresMode?.plan}
      />
      <BinancePaymentDrawer
        open={binanceMode !== null}
        onOpenChange={(open) => !open && setBinanceMode(null)}
        activateNow={binanceMode?.activateNow ?? false}
        plan={binanceMode?.plan}
      />
      {cardCheckout.dialog}
    </>
  );
}

export default SubscriptionPage;
