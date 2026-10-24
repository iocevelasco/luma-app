import { useTranslation } from 'react-i18next';
import obra480 from '../assets/images/obra-480.webp';
import obra744 from '../assets/images/obra-744.webp';
import { REGISTER_URL } from '../lib/app-url';
import { CTA_OUTLINE, CTA_PRIMARY } from '../lib/cta';

/**
 * Estados de la actividad de ejemplo, en el mismo orden que el array de i18n.
 * Usan los tokens de estado del panel: completada, en curso, en revisión.
 */
const STATE_STYLE = [
  'bg-status-active/15 text-status-active',
  'bg-primary text-primary-foreground',
  'bg-status-warning/15 text-status-warning',
] as const;

const PROGRESS = 64;

/**
 * El panel de la derecha es marcado con datos de ejemplo — `aria-hidden`,
 * porque duplicaría el texto. La foto va debajo, como una franja panorámica:
 * es un recorte de 3:1 de la pieza original, sin el texto que traía impreso.
 * Pesa ~15–30 KB en WebP y se pide con `lazy`: el LCP es el titular.
 */
export function Hero() {
  const { t } = useTranslation();
  const activities = t('hero.mock.activities', { returnObjects: true }) as {
    name: string;
    state: string;
  }[];

  return (
    <section id="top" className="hero-glow px-6 py-section-sm sm:py-section">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="section-label">{t('hero.label')}</p>

          <h1 className="mt-6 max-w-2xl text-5xl leading-[1.05] tracking-tight text-foreground sm:text-7xl">
            {t('hero.title')}
          </h1>

          <p className="mt-4 text-base font-medium text-primary">{t('hero.byline')}</p>

          <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t('hero.subtitle')}</p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href={REGISTER_URL}
              className={`${CTA_PRIMARY} h-12 px-7 text-sm`}
            >
              {t('hero.cta')}
            </a>
            <a href="#how" className={`${CTA_OUTLINE} h-12 px-7 text-sm`}>
              {t('hero.secondary')}
            </a>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="rounded-3xl border border-border bg-card p-5 shadow-surface sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-medium text-foreground">{t('hero.mock.project')}</p>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-2xs font-medium text-muted-foreground">
              {t('hero.mock.badge')}
            </span>
          </div>

          <div className="mt-5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">{t('hero.mock.progress')}</span>
              <span className="font-mono text-foreground">{PROGRESS}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${PROGRESS}%` }} />
            </div>
          </div>

          <ul className="mt-5 divide-y divide-border border-y border-border">
            {activities.map((activity, index) => (
              <li
                key={activity.name}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="text-foreground">{activity.name}</span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-2xs font-medium ${STATE_STYLE[index] ?? STATE_STYLE[2]}`}
                >
                  {activity.state}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between rounded-md bg-secondary px-4 py-3 text-sm">
            <span className="text-muted-foreground">{t('hero.mock.nextPayment')}</span>
            <span className="font-medium text-foreground">{t('hero.mock.nextPaymentValue')}</span>
          </div>
        </div>
      </div>

      <figure className="relative mx-auto mt-12 max-w-6xl overflow-hidden rounded-3xl border border-border shadow-surface sm:mt-16">
        <img
          src={obra744}
          srcSet={`${obra480} 480w, ${obra744} 744w`}
          sizes="(min-width: 1152px) 1104px, calc(100vw - 48px)"
          width={744}
          height={248}
          loading="lazy"
          decoding="async"
          alt={t('hero.photo.alt')}
          className="aspect-[16/10] w-full object-cover object-[30%_50%] sm:aspect-[3/1]"
        />
        <figcaption className="absolute bottom-3 left-3 rounded-md bg-background/85 px-3 py-2 text-sm text-foreground backdrop-blur sm:bottom-4 sm:left-4">
          {t('hero.photo.caption')}
        </figcaption>
      </figure>
    </section>
  );
}
