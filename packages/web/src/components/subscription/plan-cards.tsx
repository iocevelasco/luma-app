import type { ReactNode } from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { extraTierRanges, type PlanCode, type SubscriptionOverview } from '@luma/shared';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatPrice, formatMoney } from '@/lib/format-money';
import { hasLiveCard } from '@/lib/subscription';
import { cn } from '@/lib/utils';

interface PlanCardProps {
  id: string;
  name: string;
  description: string;
  price: string;
  period: string;
  features: string[];
  /** La pestaña que asoma arriba de la tarjeta. */
  ribbon?: string;
  cta: string;
  onPress?: () => void;
  disabled?: boolean;
  primary?: boolean;
}

function PlanCard({
  id,
  name,
  description,
  price,
  period,
  features,
  ribbon,
  cta,
  onPress,
  disabled,
  primary,
}: PlanCardProps) {
  return (
    <div className="relative flex flex-col pt-8">
      {ribbon && (
        <span className="absolute left-0 top-0 h-16 rounded-t-3xl bg-primary px-6 pt-2 text-sm text-primary-foreground">
          {ribbon}
        </span>
      )}
      <Card className="surface-dark relative h-full gap-0 px-6 py-6 shadow-overlay sm:gap-0 sm:py-6">
        <p className="text-lg text-foreground">{name}</p>
        <p className="mt-1 min-h-10 text-sm text-muted-foreground">{description}</p>

        <div className="mt-4 flex items-baseline gap-2 border-t border-border pt-4">
          <span className="whitespace-nowrap text-4xl tracking-tight text-foreground">{price}</span>
          <span className="whitespace-nowrap text-sm text-muted-foreground">{period}</span>
        </div>

        <Button
          className="mt-4 w-full"
          variant={primary ? 'default' : 'secondary'}
          onClick={onPress}
          disabled={disabled}
          data-testid={`plan-cta-${id}`}
        >
          {cta}
          {!disabled && <ArrowUpRight className="size-4" />}
        </Button>

        <ul className="mt-5 flex flex-col gap-2.5 text-sm text-foreground">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/**
 * Los planes, uno al lado del otro. Cuánto vale cada uno viene resuelto del
 * servidor; elegir uno abre el checkout con los medios de pago.
 */
export function PlanCards({
  subscription,
  upgrading,
  inReview,
  onChoose,
  onManageCard,
  managePending,
}: {
  subscription: SubscriptionOverview;
  /** En el plan Gratis y sin un pago ya mandado. */
  upgrading: boolean;
  inReview: boolean;
  onChoose: (plan: PlanCode) => void;
  onManageCard: () => void;
  managePending: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { offer } = subscription;
  // Quien entra o cambia de plan paga la lista vigente; quien renueva, la suya.
  const renewing = upgrading ? null : subscription.renewsPlan;
  const proConfig = renewing === 'pro' ? offer.config : offer.catalog;
  const liveCard = hasLiveCard(subscription);
  const usd = (amount: number) => formatMoney(amount, 'USD', i18n.language);
  const price = (amount: number) => formatPrice(amount, i18n.language);

  const paidCard = (code: PlanCode) => {
    const current = renewing === code;
    const name = t(`subscription.plans.${code}.name`);
    const cta = renewing === null
      ? t('subscription.plans.choose', { plan: name })
      : current
        ? t(liveCard ? 'subscription.pay.manageCard' : 'subscription.plans.renew')
        : t(code === 'unlimited' ? 'subscription.pay.switchUnlimited' : 'subscription.pay.switchPro');

    return {
      // En la prueba, el plan actual sigue siendo Gratis aunque haya una tarjeta cargada.
      ribbon:
        current && subscription.status !== 'prueba'
          ? t('subscription.plans.current')
          : renewing === null && code === 'pro'
            ? t('subscription.plans.recommended')
            : undefined,
      cta,
      primary: current || (renewing === null && code === 'pro'),
      disabled: liveCard ? !current || managePending : inReview,
      onPress: () => (liveCard && current ? onManageCard() : onChoose(code)),
    };
  };

  const cards: ReactNode[] = [];

  if (subscription.status === 'prueba') {
    cards.push(
      <PlanCard
        key="free"
        id="free"
        name={t('subscription.plans.free.name')}
        description={t('subscription.plans.free.description')}
        price={price(0)}
        period={t('subscription.plans.free.period', { count: offer.catalog.trialDays })}
        features={[
          t('subscription.plans.free.projects', { count: offer.catalog.includedProjects }),
          t('subscription.plans.free.noCard'),
        ]}
        cta={t('subscription.plans.current')}
        disabled
      />,
    );
  }

  cards.push(
    <PlanCard
      key="pro"
      id="pro"
      name={t('subscription.plans.pro.name')}
      description={t('subscription.plans.pro.description')}
      price={price(proConfig.basePriceUsd)}
      period={t('subscription.plans.perMonth')}
      features={[
        t('subscription.plans.pro.included', { count: proConfig.includedProjects }),
        ...extraTierRanges(proConfig).map((tier) =>
          tier.to === null
            ? t('subscription.upgrade.tierLast', { from: tier.from, price: usd(tier.unitUsd) })
            : t('subscription.upgrade.tier', { from: tier.from, to: tier.to, price: usd(tier.unitUsd) }),
        ),
      ]}
      {...paidCard('pro')}
    />,
  );

  if (offer.unlimitedUsd !== null) {
    cards.push(
      <PlanCard
        key="unlimited"
        id="unlimited"
        name={t('subscription.plans.unlimited.name')}
        description={t('subscription.plans.unlimited.description')}
        price={price(offer.unlimitedUsd)}
        period={t('subscription.plans.perMonth')}
        features={[
          t('subscription.plans.unlimited.projects'),
          t('subscription.plans.unlimited.noExtras'),
          t('subscription.plans.unlimited.fixed'),
        ]}
        {...paidCard('unlimited')}
      />,
    );
  }

  return (
    <div className={cn('grid gap-4', cards.length === 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2')}>{cards}</div>
  );
}
