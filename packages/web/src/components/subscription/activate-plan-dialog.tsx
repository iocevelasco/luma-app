import { CreditCard, Landmark } from 'lucide-react';
import { PLAN } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { useNavigate } from 'react-router-dom';
import { useCardCheckout } from '@/components/subscription/card-checkout-dialog';
import { ROUTES } from '@/lib/routes';
import type { SubscriptionOverview } from '@luma/shared';

/**
 * Lo que aparece al tocar "Nueva obra" en la prueba con 3 obras activas.
 *
 * La cuarta obra no se puede crear gratis: activar el plan la destraba, y
 * arranca HOY (los días gratis que quedan se pierden — es la regla que se
 * acordó). El diálogo lo dice antes de que la persona pague, con el monto.
 */
export function ActivatePlanDialog({
  open,
  onOpenChange,
  subscription,
  onPayInBolivares,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: SubscriptionOverview;
  onPayInBolivares: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Al terminar el pago, a Suscripción: ahí se espera al webhook y se ve el
  // plan Pro, igual que al volver de la página de Stripe.
  const checkout = useCardCheckout({
    onComplete: () => navigate(`${ROUTES.SUBSCRIPTION}?stripe=ok`),
  });
  // La cuarta obra entra como extra: base + una.
  const extras = Math.max(0, subscription.activeProjects + 1 - subscription.includedProjects);
  const total = PLAN.basePriceUsd + extras * PLAN.extraProjectPriceUsd;

  return (
    <>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title={t('subscription.activate.title')}
        description={t('subscription.activate.body')}
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
            {t('subscription.activate.total', { amount: total })}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('subscription.activate.cancel')}
            </Button>
            {subscription.paymentOptions.bolivares && (
              <Button
                variant="secondary"
                onClick={() => {
                  onOpenChange(false);
                  onPayInBolivares();
                }}
              >
                <Landmark className="size-4" />
                {t('subscription.activate.bolivares')}
              </Button>
            )}
            {subscription.paymentOptions.card && (
              <Button
                onClick={() =>
                  checkout.start({ activateNow: true, includeNextProject: true }, () =>
                    onOpenChange(false),
                  )
                }
                disabled={checkout.isPending}
              >
                <CreditCard className="size-4" />
                {t('subscription.activate.card')}
              </Button>
            )}
          </div>
        </div>
      </ResponsiveDialog>
      {checkout.dialog}
    </>
  );
}
