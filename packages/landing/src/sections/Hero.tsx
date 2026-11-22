import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import heroVideo from '../assets/video/hero-banner.mp4';
import architectImg from '../assets/images/team-status-gantt.webp';
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
  // El video arranca solo salvo que el sistema pida menos movimiento.
  const [autoPlay] = useState(
    () =>
      !(
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ),
  );
  const activities = t('hero.mock.activities', { returnObjects: true }) as {
    name: string;
    state: string;
  }[];

  return (
    <section id="top">
      <div className="relative isolate overflow-hidden px-6 py-section-sm sm:py-section">
        <video
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          src={heroVideo}
          poster={obra744}
          autoPlay={autoPlay}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-background via-transparent to-background/60" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="section-label">{t('hero.label')}</p>

            <h1 className="mt-6 max-w-2xl text-5xl leading-[1.05] tracking-tight text-foreground sm:text-7xl">
              {t('hero.title')}
            </h1>

            <p className="mt-4 text-base font-medium text-primary">{t('hero.byline')}</p>

            <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t('hero.subtitle')}</p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <a href={REGISTER_URL} className={`${CTA_PRIMARY} h-12 px-7 text-sm`}>
                {t('hero.cta')}
              </a>
              <a href="#how" className={`${CTA_OUTLINE} h-12 px-7 text-sm`}>
                {t('hero.secondary')}
              </a>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="rounded-none border border-border bg-card p-5 shadow-surface sm:p-6"
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
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-section-sm sm:pb-section">
        <figure className="relative isolate mt-12 max-w-6xl overflow-hidden rounded-3xl border border-border shadow-surface sm:mt-16">
          <img
            src={architectImg}
            sizes="(min-width: 1152px) 1104px, calc(100vw - 48px)"
            width={1920}
            height={800}
            loading="lazy"
            decoding="async"
            alt={t('hero.photo.alt')}
            className="aspect-[4/5] w-full object-cover object-[60%_50%] sm:aspect-[16/8] lg:aspect-[21/9]"
          />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-scrim via-scrim/60 to-transparent" />
          <figcaption className="absolute inset-0 flex max-w-xl flex-col justify-end p-8 sm:justify-center sm:p-12">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              {t('hero.photo.label')}
            </p>
            <h2 className="mt-4 text-3xl leading-[1.1] tracking-tight text-on-scrim sm:text-5xl">
              {t('hero.photo.title')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-on-scrim/80 sm:text-lg">
              {t('hero.photo.body')}
            </p>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
