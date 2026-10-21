/**
 * Stripe.js, cargado a mano y sólo cuando se abre el pago con tarjeta.
 *
 * Sin `@stripe/stripe-js`: ese paquete no hace más que inyectar este mismo
 * `<script>` (Stripe exige servirlo siempre desde js.stripe.com, nunca
 * empaquetado), y la API ya habla con Stripe sin SDK. Acá se tipa sólo lo
 * que usa el checkout embebido.
 *
 * La versión del script va con la de la API (`2025-03-31.basil`, ver
 * `stripe.client.ts`): con otra, `initEmbeddedCheckout` cambia de nombre.
 */

const STRIPE_JS_URL = 'https://js.stripe.com/basil/stripe.js';

export interface EmbeddedCheckout {
  mount(target: HTMLElement | string): void;
  unmount(): void;
  destroy(): void;
}

interface StripeInstance {
  initEmbeddedCheckout(options: {
    fetchClientSecret: () => Promise<string>;
    onComplete?: () => void;
  }): Promise<EmbeddedCheckout>;
}

type StripeFactory = (publishableKey: string) => StripeInstance;

declare global {
  interface Window {
    Stripe?: StripeFactory;
  }
}

let loading: Promise<StripeFactory> | null = null;

function loadStripeJs(): Promise<StripeFactory> {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (loading) return loading;

  loading = new Promise<StripeFactory>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = STRIPE_JS_URL;
    script.async = true;
    script.onload = () =>
      window.Stripe ? resolve(window.Stripe) : reject(new Error('Stripe.js no se inicializó'));
    script.onerror = () => reject(new Error('No se pudo cargar Stripe.js'));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Que el próximo intento pruebe de nuevo (p. ej. volvió la conexión).
    loading = null;
    document.querySelector(`script[src="${STRIPE_JS_URL}"]`)?.remove();
    throw error;
  });
  return loading;
}

/** Una instancia por publishable key: Stripe recomienda no recrearla. */
const instances = new Map<string, StripeInstance>();

export async function getStripe(publishableKey: string): Promise<StripeInstance> {
  const cached = instances.get(publishableKey);
  if (cached) return cached;
  const factory = await loadStripeJs();
  const instance = factory(publishableKey);
  instances.set(publishableKey, instance);
  return instance;
}
