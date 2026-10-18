import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function Pricing() {
  const { t } = useTranslation();
  const perks = t('pricing.perks', { returnObjects: true }) as string[];

  return (
    <section id="pricing" className="scroll-mt-16 px-6 py-section-sm sm:py-section">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="section-label">{t('pricing.label')}</p>
          <h2 className="mt-6 text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            {t('pricing.title')}
          </h2>
        </div>

        <div className="rounded-3xl border border-border bg-card p-8 shadow-surface sm:p-10">
          <p className="flex items-baseline gap-3">
            <span className="text-6xl tracking-tight text-foreground sm:text-7xl">
              {t('pricing.amount')}
            </span>
            <span className="text-lg text-muted-foreground">{t('pricing.period')}</span>
          </p>

          <ul className="mt-8 space-y-3 border-t border-border pt-8">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 text-base text-foreground">
                <Check aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
