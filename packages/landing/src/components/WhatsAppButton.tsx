import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { WHATSAPP_NUMBER } from '../lib/app-url';
import { cn } from '../lib/utils';

/**
 * Botón flotante de WhatsApp. Abre un chat con un mensaje ya escrito; el
 * número sale de `lib/app-url.ts`. Siempre visible en la esquina inferior.
 */
export function WhatsAppButton() {
  const { t } = useTranslation();
  const href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t('whatsapp.message'))}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('whatsapp.label')}
      className={cn(
        'fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-primary-pressed bg-primary text-primary-foreground shadow-cta transition duration-300 ease-out outline-none hover:-translate-y-1 hover:scale-105 hover:bg-primary-pressed focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary active:shadow-cta-pressed',
      )}
    >
      <MessageCircle aria-hidden="true" className="h-7 w-7" />
    </a>
  );
}
