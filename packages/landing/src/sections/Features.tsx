import { useTranslation } from 'react-i18next';

/**
 * Tres celdas placeholder. El contenido sale de i18n como un array, así que
 * agregar o quitar una es editar el JSON, no el componente.
 */
export function Features() {
  const { t } = useTranslation();
  const items = t('features.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  return (
    <section id="features" className="bg-cream-soft px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-5xl">
        <p className="section-label">{t('features.label')}</p>
        <h2 className="mt-6 max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t('features.title')}
        </h2>

        <div className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-3">
          {items.map((item, index) => (
            <article key={item.title} className="bg-background p-8">
              <span className="feature-num">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
