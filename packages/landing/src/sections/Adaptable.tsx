import { useTranslation } from 'react-i18next';
import { REGISTER_URL } from '../lib/app-url';
import { CTA_PRIMARY } from '../lib/cta';

/** Se adapta a tu negocio: tres razones concretas, sin lista de features. */
export function Adaptable() {
  const { t } = useTranslation();
  const items = t('adaptable.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  return (
    <section id="adaptable" className="scroll-mt-16 px-6 py-section-sm sm:py-section">
      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="section-label">{t('adaptable.label')}</p>
          <h2 className="mt-6 text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            {t('adaptable.title')}
          </h2>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">{t('adaptable.subtitle')}</p>
          <a href={REGISTER_URL} className={`${CTA_PRIMARY} mt-8 h-12 px-7 text-sm`}>
            {t('adaptable.cta')}
          </a>
        </div>

        <ol className="grid gap-8">
          {items.map((item, index) => (
            <li key={item.title} className="border-t border-border-strong pt-6">
              <span className="feature-num">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-lg font-medium text-foreground">{item.title}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
