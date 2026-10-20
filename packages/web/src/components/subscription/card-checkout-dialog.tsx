import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StripeCheckoutStart } from '@luma/shared';
import { Button } from '@/components/ui/button';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Spinner } from '@/components/ui/spinner';
import { useStripeCheckout } from '@/hooks/subscription/use-subscription-queries';
import { getStripe, type EmbeddedCheckout } from '@/lib/stripe-js';

type EmbeddedSession = Extract<StripeCheckoutStart, { mode: 'embedded' }>;

/**
 * Stripe deja un solo checkout embebido vivo a la vez. Montar y desmontar
 * pasan en fila: si el modal se cierra y se abre rápido (o React monta dos
 * veces el efecto en desarrollo), el segundo espera a que el primero termine.
 */
let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * El formulario de pago de Stripe, dentro de un modal de Luma (en mobile, un
 * drawer). La tarjeta se carga en un iframe de Stripe: no pasa por Luma.
 *
 * Al terminar, Stripe avisa con `onComplete` y el modal se cierra; que el
 * plan quede Pro lo decide el webhook, como siempre. Cerrar el modal sin
 * pagar no deja nada a medias: la sesión de Stripe vence sola.
 */
export function CardCheckoutDialog({
  session,
  onClose,
  onComplete,
}: {
  session: EmbeddedSession | null;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  // Estado, no `useRef`: el contenido del modal entra en un portal y el nodo
  // aparece un render después de abrir.
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!session || !container) return;
    let cancelled = false;
    let checkout: EmbeddedCheckout | null = null;
    setStatus('loading');

    oneAtATime(async () => {
      const stripe = await getStripe(session.publishableKey);
      if (cancelled) return;
      const instance = await stripe.initEmbeddedCheckout({
        fetchClientSecret: async () => session.clientSecret,
        onComplete: () => onCompleteRef.current(),
      });
      if (cancelled) {
        instance.destroy();
        return;
      }
      checkout = instance;
      instance.mount(container);
      setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [session, container, attempt]);

  return (
    <ResponsiveDialog
      open={session !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t('subscription.cardCheckout.title')}
      description={t('subscription.cardCheckout.description')}
      className="max-h-[92vh] overflow-y-auto sm:max-w-xl"
      // Stripe abre el captcha y el 3D Secure en capas propias, fuera del modal.
      modal={false}
    >
      <div className="relative min-h-[420px]">
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {t('subscription.cardCheckout.loading')}
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-sm">
            <p className="text-muted-foreground">{t('subscription.cardCheckout.error')}</p>
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              {t('subscription.cardCheckout.retry')}
            </Button>
          </div>
        )}
        {/* El checkout de Stripe es claro siempre; en modo oscuro va en su
            propia tarjeta blanca en vez de flotar sobre el fondo. */}
        <div
          ref={setContainer}
          data-testid="stripe-embedded-checkout"
          className="overflow-hidden rounded-2xl bg-white"
        />
      </div>
    </ResponsiveDialog>
  );
}

/**
 * Pagar con tarjeta desde cualquier pantalla: `start()` pide la sesión y, si
 * es embebida, abre el modal; `dialog` se renderiza donde se use.
 */
export function useCardCheckout({ onComplete }: { onComplete: () => void }) {
  const checkout = useStripeCheckout();
  const [session, setSession] = useState<EmbeddedSession | null>(null);

  /** `onOpen`: p. ej. cerrar el diálogo desde el que se pidió, para no apilar dos modales. */
  const start = (
    options: { activateNow: boolean; includeNextProject?: boolean },
    onOpen?: () => void,
  ) =>
    checkout.mutate(options, {
      onSuccess: (result) => {
        if (result.mode !== 'embedded') return;
        onOpen?.();
        setSession(result);
      },
    });

  const dialog = (
    <CardCheckoutDialog
      session={session}
      onClose={() => setSession(null)}
      onComplete={() => {
        setSession(null);
        onComplete();
      }}
    />
  );

  return { start, isPending: checkout.isPending, dialog };
}
