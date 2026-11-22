import { useTranslation } from 'react-i18next';
import { TESTIMONIALS } from '../lib/testimonials';

/**
 * Lo que dice la gente. Sólo se renderiza con citas reales en
 * `lib/testimonials.ts`; con la lista vacía, `App.tsx` ni la monta.
 */
export function Testimonials() {
  const { t } = useTranslation();

  return (
    <section id="testimonios" className="scroll-mt-16 px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-6xl">
        <p className="section-label">{t('testimonials.label')}</p>
        <h2 className="mt-6 max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('testimonials.title')}
        </h2>

        <ul className="mt-12 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <li
              key={item.name}
              className="flex flex-col rounded-none border border-border bg-background p-6 shadow-surface"
            >
              <blockquote className="flex-1 text-base leading-relaxed text-foreground">
                “{item.quote}”
              </blockquote>
              <p className="mt-6 text-sm font-medium text-foreground">{item.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.role}, {item.company}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
