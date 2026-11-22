import { Linkedin, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TEAM } from '../lib/team';

/**
 * Quiénes somos: fotos en gris; al pasar el mouse (o al enfocar la tarjeta con
 * el teclado o un toque) aparecen el nombre, la descripción y el LinkedIn. El
 * cargo va siempre debajo de la tarjeta. El texto siempre está en el DOM: sólo
 * cambia su opacidad.
 */
export function Team() {
  const { t } = useTranslation();

  return (
    <section id="equipo" className="scroll-mt-16 px-6 py-section-sm text-center sm:py-section">
      <div className="mx-auto max-w-6xl">
        <p className="section-label">{t('team.label')}</p>
        <h2 className="mx-auto mt-6 max-w-2xl text-4xl leading-[1.1] tracking-tight text-foreground sm:text-5xl">
          {t('team.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{t('team.subtitle')}</p>

        <ul className="mx-auto mt-12 grid max-w-3xl gap-8 sm:grid-cols-2">
          {TEAM.map((member) => (
            <li key={member.id}>
              <article
                tabIndex={0}
                className="group relative mx-auto aspect-[4/5] overflow-hidden rounded-none bg-secondary text-center shadow-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {member.photo ? (
                  <img
                    src={member.photo}
                    alt={member.name}
                    width={480}
                    height={480}
                    loading="lazy"
                    className="h-full w-full object-cover grayscale transition duration-500 group-hover:scale-[1.03] group-hover:grayscale-0 group-focus-within:grayscale-0"
                  />
                ) : (
                  <div
                    role="img"
                    aria-label={t('team.photoPlaceholder', { name: member.name })}
                    className="flex h-full w-full items-center justify-center text-muted-foreground"
                  >
                    <User aria-hidden="true" className="h-16 w-16" strokeWidth={1.25} />
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-scrim via-scrim/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" />

                <div className="absolute inset-x-0 bottom-0 translate-y-4 p-6 text-on-scrim opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:p-8">
                  <h3 className="text-2xl font-medium">{member.name}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-on-scrim/90">
                    {t(`team.members.${member.id}.bio`)}
                  </p>

                  {member.linkedin && (
                    <a
                      href={member.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t('team.linkedin', { name: member.name })}
                      className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <Linkedin aria-hidden="true" className="h-4 w-4" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </article>

              <p className="mt-4 text-base font-medium text-foreground">
                {t(`team.members.${member.id}.role`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
