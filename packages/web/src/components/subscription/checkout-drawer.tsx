import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Coins, CreditCard, Landmark, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { PlanCode, SubscriptionOverview } from '@luma/shared';
import { FormDrawer } from '@/components/common/form-drawer';
import { NoPaymentMethods } from '@/components/subscription/no-payment-methods';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useDateLocale } from '@/hooks/use-date-locale';
import { formatMoney } from '@/lib/format-money';
import { cn } from '@/lib/utils';

type Start = 'now' | 'trialEnd';

/** Con qué se pagó y qué: lo que necesita quien abre el pago en sí. */
export interface CheckoutChoice {
  activateNow: boolean;
  /** Sin esto se renueva el plan que ya tiene. */
  plan?: PlanCode;
}

/**
 * El checkout: el plan elegido, cuánto sale y cómo pagarlo. En el plan Gratis
 * pregunta además desde cuándo, y la diferencia se dice antes de pagar: desde
 * hoy se pierden los días gratis; al terminar, no.
 */
export function CheckoutDrawer({
  plan,
  onClose,
  subscription,
  upgrading,
  cardPending,
  onPayCard,
  onPayBolivares,
  onPayBinance,
}: {
  /** `null`: cerrado. */
  plan: PlanCode | null;
  onClose: () => void;
  subscription: SubscriptionOverview;
  upgrading: boolean;
  cardPending: boolean;
  onPayCard: (choice: CheckoutChoice) => void;
  onPayBolivares: (choice: CheckoutChoice) => void;
  onPayBinance: (choice: CheckoutChoice) => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = useDateLocale();
  const [start, setStart] = useState<Start>('now');
  // Cada checkout arranca igual: lo elegido en el anterior no viaja al siguiente.
  useEffect(() => {
    if (plan) setStart('now');
  }, [plan]);

  const { offer, paymentOptions } = subscription;
  const included = offer.config.includedProjects;
  const unlimited = plan === 'unlimited';
  const samePlan = plan === subscription.plan;
  const usd = (amount: number) => formatMoney(amount, 'USD', i18n.language);
  const trialEnd = subscription.trialEndsAt
    ? format(new Date(subscription.trialEndsAt), 'PP', { locale })
    : '';

  const activateNow = upgrading && start === 'now';
  const choice: CheckoutChoice = {
    activateNow,
    // Renovar lo mismo no manda plan: así mantiene su lista de precios.
    plan: upgrading || !samePlan ? (plan ?? undefined) : undefined,
  };

  const upgradeTotal = unlimited
    ? (offer.unlimitedUsd ?? 0)
    : activateNow
      ? offer.proTodayUsd
      : (subscription.nextCharge?.totalUsd ?? offer.config.basePriceUsd);
  const renewalTotal = samePlan
    ? (subscription.nextCharge?.totalUsd ?? 0)
    : unlimited
      ? (offer.unlimitedUsd ?? 0)
      : offer.proTodayUsd;

  const cardAllowed = upgrading ? !unlimited : samePlan;
  const methods: { id: string; icon: LucideIcon; label: string; hint: string; onPress: () => void }[] = [
    ...(paymentOptions.card && cardAllowed
      ? [
          {
            id: 'card',
            icon: CreditCard,
            label: t('subscription.pay.card'),
            hint: t('subscription.pay.cardHint'),
            onPress: () => onPayCard(choice),
          },
        ]
      : []),
    ...(paymentOptions.bolivares
      ? [
          {
            id: 'bolivares',
            icon: Landmark,
            label: t('subscription.pay.bolivares'),
            hint: t('subscription.pay.bolivaresHint'),
            onPress: () => onPayBolivares(choice),
          },
        ]
      : []),
    ...(paymentOptions.binance
      ? [
          {
            id: 'binance',
            icon: Coins,
            label: t('subscription.pay.binance'),
            hint: t('subscription.pay.binanceHint'),
            onPress: () => onPayBinance(choice),
          },
        ]
      : []),
  ];

  const startOptions: { value: Start; title: string; hint: string }[] = [
    {
      value: 'now',
      title: t('subscription.upgrade.now'),
      hint: t('subscription.upgrade.nowHint', { count: subscription.trialDaysLeft ?? 0, included }),
    },
    {
      value: 'trialEnd',
      title: t('subscription.upgrade.trialEnd'),
      hint: t('subscription.upgrade.trialEndHint', { date: trialEnd, included }),
    },
  ];

  return (
    <FormDrawer
      open={plan !== null}
      onOpenChange={(next) => !next && onClose()}
      title={t('subscription.plans.checkoutTitle', {
        plan: t(`subscription.plans.${plan ?? 'pro'}.name`),
      })}
      size="md"
    >
      <div className="flex flex-col gap-4">
        {upgrading && (
          <RadioGroup
            value={start}
            onValueChange={(next) => setStart(next as Start)}
            className="flex flex-col gap-2"
            aria-label={t('subscription.upgrade.when')}
          >
            {startOptions.map((option) => (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                className={cn(
                  'w-full cursor-pointer rounded-2xl border bg-background p-4 transition-colors',
                  start === option.value ? 'border-primary' : 'border-border',
                )}
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.title}</span>
                  <span className="text-sm text-muted-foreground">{option.hint}</span>
                </span>
              </RadioGroupItem>
            ))}
          </RadioGroup>
        )}

        <p className="text-sm">
          {!upgrading
            ? t('subscription.plans.renewalTotal', { amount: usd(renewalTotal) })
            : activateNow
              ? t('subscription.upgrade.totalNow', { amount: usd(upgradeTotal) })
              : t('subscription.upgrade.totalLater', { amount: usd(upgradeTotal), date: trialEnd })}
        </p>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">{t('subscription.plans.howToPay')}</p>
          {methods.map(({ id, icon: Icon, label, hint, onPress }) => (
            <div
              key={id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-background p-4 sm:flex-row sm:items-center"
            >
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">{hint}</p>
              <Button
                variant={id === methods[0].id ? 'default' : 'secondary'}
                onClick={onPress}
                disabled={id === 'card' && cardPending}
                data-testid={`checkout-${id}`}
              >
                {label}
              </Button>
            </div>
          ))}
          {methods.length === 0 && <NoPaymentMethods />}
        </div>
      </div>
    </FormDrawer>
  );
}
