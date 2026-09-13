import { useTranslation } from 'react-i18next';
import { REGISTER_URL } from '../lib/app-url';

export function Hero() {
  const { t } = useTranslation();

  return (
    <section id="top" className="hero-sunset px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-5xl">
        <p className="section-label text-muted-foreground">{t('hero.label')}</p>

        <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
          {t('hero.title')}
        </h1>

        <p className="mt-6 max-w-xl text-lg text-muted-foreground">{t('hero.subtitle')}</p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={REGISTER_URL}
            className="cta-label rounded-md bg-primary px-6 py-3 text-sm text-primary-foreground transition-colors hover:bg-primary-pressed active:bg-primary-pressed"
          >
            {t('hero.cta')}
          </a>
          <a href="#features" className="nav-label text-sm text-muted-foreground hover:text-foreground">
            {t('hero.secondary')}
          </a>
        </div>
      </div>
    </section>
  );
}
