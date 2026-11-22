import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CONTACT_EMAIL } from '../lib/app-url';
import { CTA_OUTLINE } from '../lib/cta';

/**
 * Contacto visible: el correo se ve en la página y se copia con un botón. No
 * abre ninguna app de correo: en muchos equipos `mailto:` no hace nada.
 */
export function Contact() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(id);
  }, [copied]);

  const copy = async () => {
    try {
      if (typeof window.navigator.clipboard?.writeText !== 'function') return;
      await window.navigator.clipboard.writeText(CONTACT_EMAIL);
      setCopied(true);
    } catch {
      // Sin permiso de portapapeles: el correo sigue visible para seleccionarlo a mano.
    }
  };

  return (
    <section id="contacto" className="scroll-mt-16 px-6 py-section-sm sm:py-section">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
        <p className="section-label">{t('contact.label')}</p>
        <h2 className="max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('contact.title')}
        </h2>
        <p className="max-w-xl text-lg text-muted-foreground">{t('contact.subtitle')}</p>

        <div className="flex w-full flex-col gap-4 rounded-none border border-border bg-background p-6 shadow-surface sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <p className="break-all text-2xl tracking-tight text-foreground sm:text-3xl">{CONTACT_EMAIL}</p>
          <button
            type="button"
            onClick={copy}
            className={`${CTA_OUTLINE} h-11 shrink-0 gap-2 px-6 text-sm`}
            aria-live="polite"
          >
            {copied ? <Check aria-hidden="true" className="h-4 w-4 text-brand" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
            {copied ? t('contact.copied') : t('contact.copy')}
          </button>
        </div>
      </div>
    </section>
  );
}
