import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppLogo } from '@/components/app-logo';
import { landingLegalUrl, type LandingLegalPage } from '@/lib/landing-url';
import { ROUTES } from '@/lib/routes';

const LINKS: { page: LandingLegalPage; key: 'terms' | 'privacy' | 'cancellation' }[] = [
  { page: 'terminos', key: 'terms' },
  { page: 'privacidad', key: 'privacy' },
  { page: 'baja-servicio', key: 'cancellation' },
];

/**
 * El texto largo vive en la landing (`/home/terminos`, `/home/privacidad` y
 * `/home/baja-servicio`). Esta página sólo lleva hasta ahí, para que el enlace
 * viejo `/legal` y el aviso del registro sigan teniendo a dónde ir.
 */
export function LegalPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10 sm:py-16">
        <div className="flex items-center justify-between">
          <AppLogo size="lg" />
          <Link
            to={ROUTES.LOGIN}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t('legal.hub.back')}
          </Link>
        </div>

        <header className="flex flex-col gap-3">
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">{t('legal.hub.title')}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t('legal.hub.intro')}</p>
        </header>

        <ul className="flex flex-col gap-3">
          {LINKS.map((link) => (
            <li key={link.page}>
              <a
                href={landingLegalUrl(link.page)}
                className="text-base text-brand underline underline-offset-4"
              >
                {t(`legal.hub.${link.key}`)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default LegalPage;
