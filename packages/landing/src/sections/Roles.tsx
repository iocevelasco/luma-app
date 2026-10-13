import { useTranslation } from 'react-i18next';

/**
 * La grilla de permisos de la app, contada para quien la va a usar. Los
 * textos salen de packages/shared/src/permissions: si esa grilla cambia, esta
 * sección es la que hay que revisar.
 */
export function Roles() {
  const { t } = useTranslation();
  const items = t('roles.items', { returnObjects: true }) as {
    name: string;
    does: string;
    never: string;
  }[];

  return (
    <section id="roles" className="scroll-mt-16 bg-card px-6 py-section-sm sm:py-section">
      <div className="mx-auto max-w-6xl">
        <p className="section-label">{t('roles.label')}</p>
        <h2 className="mt-6 max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('roles.title')}
        </h2>
        <p className="mt-4 max-w-xl text-lg text-muted-foreground">{t('roles.subtitle')}</p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((role) => (
            <article
              key={role.name}
              className="flex flex-col rounded-3xl border border-border bg-background p-6 shadow-surface"
            >
              <h3 className="text-xl font-medium text-foreground">{role.name}</h3>

              <p className="section-label mt-5">{t('roles.sees')}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.does}</p>

              <p className="section-label mt-5">{t('roles.never')}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{role.never}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
