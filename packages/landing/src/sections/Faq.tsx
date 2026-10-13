import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** `<details>` nativo: abre y cierra sin una línea de JS y es accesible por teclado. */
export function Faq() {
  const { t } = useTranslation();
  const items = t('faq.items', { returnObjects: true }) as { q: string; a: string }[];

  return (
    <section id="faq" className="scroll-mt-16 px-6 py-section-sm sm:py-section">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="section-label">{t('faq.label')}</p>
          <h2 className="mt-6 text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            {t('faq.title')}
          </h2>
        </div>

        <div className="border-t border-border-strong">
          {items.map((item) => (
            <details key={item.q} className="group border-b border-border-strong">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  aria-hidden="true"
                  className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="pb-5 pr-9 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
