import { useTranslation } from 'react-i18next';

export function How() {
  const { t } = useTranslation();
  const steps = t('how.steps', { returnObjects: true }) as { title: string; body: string }[];

  return (
    <section id="how" className="scroll-mt-16 bg-card px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-6xl">
        <p className="section-label">{t('how.label')}</p>
        <h2 className="mt-6 max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('how.title')}
        </h2>

        <ol className="mt-12 grid gap-10 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className="spec-number text-primary">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-lg font-medium text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
