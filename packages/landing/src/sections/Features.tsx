import { useTranslation } from 'react-i18next';

export function Features() {
  const { t } = useTranslation();
  const items = t('features.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  return (
    <section id="features" className="scroll-mt-16 px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-6xl">
        <p className="section-label">{t('features.label')}</p>
        <h2 className="mt-6 max-w-3xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('features.title')}
        </h2>

        <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            // Son cinco: la última ocupa el hueco que dejaría una sexta. Si el
            // número de ítems cambia, revisá este `col-span`.
            <article key={item.title} className="bg-background p-8 sm:last:col-span-2">
              <span className="feature-num">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-4 text-lg font-medium text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
