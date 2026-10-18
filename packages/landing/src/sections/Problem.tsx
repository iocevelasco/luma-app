import { useTranslation } from 'react-i18next';

export function Problem() {
  const { t } = useTranslation();
  const items = t('problem.items', { returnObjects: true }) as { q: string; a: string }[];

  return (
    <section className="px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-6xl">
        <p className="section-label">{t('problem.label')}</p>
        <h2 className="mt-6 max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('problem.title')}
        </h2>

        <ol className="mt-12 grid gap-8 sm:grid-cols-2">
          {items.map((item, index) => (
            <li key={item.q} className="border-t border-border-strong pt-6">
              <span className="feature-num">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-lg font-medium text-foreground">{item.q}</h3>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">{item.a}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
