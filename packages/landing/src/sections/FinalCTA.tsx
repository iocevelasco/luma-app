import { useTranslation } from 'react-i18next';
import { REGISTER_URL } from '../lib/app-url';

export function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className="bg-card px-6 py-section-sm sm:py-section">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6">
        <h2 className="max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('finalCta.title')}
        </h2>
        <p className="max-w-xl text-lg text-muted-foreground">{t('finalCta.subtitle')}</p>
        <a
          href={REGISTER_URL}
          className="cta-label rounded-md bg-primary px-6 py-3 text-sm text-primary-foreground transition-colors hover:bg-primary-pressed active:bg-primary-pressed"
        >
          {t('finalCta.cta')}
        </a>
      </div>
    </section>
  );
}
