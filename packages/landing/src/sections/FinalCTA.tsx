import { useTranslation } from 'react-i18next';
import { REGISTER_URL } from '../lib/app-url';

export function FinalCTA() {
  const { t } = useTranslation();

  return (
    <section className="bg-canvas px-6 py-section-sm sm:py-section">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-6">
        <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t('finalCta.title')}
        </h2>
        <p className="max-w-xl text-body">{t('finalCta.subtitle')}</p>
        <a
          href={REGISTER_URL}
          className="cta-label rounded-edge bg-red-ink px-6 py-3 text-sm text-white transition-colors hover:bg-red-deep active:bg-red-press"
        >
          {t('finalCta.cta')}
        </a>
      </div>
    </section>
  );
}
