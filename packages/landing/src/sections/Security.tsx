import { DatabaseBackup, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Mismo orden que `security.items` en i18n: confidencialidad, backups. */
const ICONS = [ShieldCheck, DatabaseBackup] as const;

export function Security() {
  const { t } = useTranslation();
  const items = t('security.items', { returnObjects: true }) as {
    title: string;
    body: string;
  }[];

  return (
    <section id="security" className="scroll-mt-16 bg-card px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-6xl">
        <p className="section-label">{t('security.label')}</p>
        <h2 className="mt-6 max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('security.title')}
        </h2>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t('security.lead')}
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {items.map((item, index) => {
            const Icon = ICONS[index] ?? ShieldCheck;
            return (
              <article
                key={item.title}
                className="rounded-3xl border border-border bg-background p-8"
              >
                <Icon aria-hidden="true" className="h-6 w-6 text-primary" />
                <h3 className="mt-4 text-lg font-medium text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
