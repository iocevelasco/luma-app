import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { CONTACT_EMAIL } from '../lib/app-url';
import { landingHref, type LegalRoute } from '../lib/paths';

interface LegalSection {
  title: string;
  paragraphs: string[];
}

const NAV: LegalRoute[] = ['terminos', 'privacidad', 'baja-servicio'];

const NAV_KEY: Record<LegalRoute, string> = {
  terminos: 'footer.terms',
  privacidad: 'footer.privacy',
  'baja-servicio': 'footer.cancellation',
};

function LegalNav({ current }: { current: LegalRoute }) {
  const { t } = useTranslation();
  return (
    <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t('legal.also')}>
      {NAV.map((route) => (
        <a
          key={route}
          href={landingHref(route)}
          aria-current={route === current ? 'page' : undefined}
          className={`text-sm ${route === current ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          {t(NAV_KEY[route])}
        </a>
      ))}
    </nav>
  );
}

export function LegalFrame({
  current,
  title,
  children,
}: {
  current: LegalRoute;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${title} · Luma`;
  }, [title]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <a href={landingHref('home')} aria-label={t('brand')}>
            <Logo />
          </a>
          <LegalNav current={current} />
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:py-16">{children}</main>
    </div>
  );
}

export function LegalDocument({ kind }: { kind: 'terms' | 'privacy' }) {
  const { t } = useTranslation();
  const route: LegalRoute = kind === 'terms' ? 'terminos' : 'privacidad';
  const sections = t(`legal.${kind}.sections`, { returnObjects: true }) as LegalSection[];
  const title = t(`legal.${kind}.title`);

  return (
    <LegalFrame current={route} title={title}>
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{title}</h1>
        <p className="text-base leading-relaxed text-muted-foreground">{t(`legal.${kind}.intro`)}</p>
      </header>

      {sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3">
          <h2 className="text-xl">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <p className="text-sm leading-relaxed text-muted-foreground">
        {t('legal.also')}{' '}
        <a
          href={landingHref(kind === 'terms' ? 'privacidad' : 'terminos')}
          className="text-foreground underline underline-offset-4"
        >
          {t(kind === 'terms' ? 'legal.privacyLink' : 'legal.termsLink')}
        </a>{' '}
        {t('legal.and')}{' '}
        <a href={landingHref('baja-servicio')} className="text-foreground underline underline-offset-4">
          {t('legal.cancellationLink')}
        </a>.
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {t('legal.contact', { email: CONTACT_EMAIL })}
      </p>
    </LegalFrame>
  );
}
