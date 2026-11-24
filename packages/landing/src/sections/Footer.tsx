import { Trans, useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { LOGIN_URL } from '../lib/app-url';
import { landingHref, legalRoute } from '../lib/paths';

const STUDIO_URL = 'https://www.instagram.com/ido.arquitectura/';

export function Footer() {
  const { t } = useTranslation();
  const onHome = legalRoute(window.location.pathname) === null;

  return (
    <footer className="border-t border-border bg-background px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <Logo />
          {/* El nombre de la app tal cual figura en Google Cloud: Google lo busca en esta página para verificar la marca. */}
          <p className="text-sm text-foreground">{t('footer.appName')}</p>
          <p className="text-sm text-muted-foreground">{t('footer.tagline')}</p>
          <p className="text-sm text-muted-foreground">
            <Trans
              i18nKey="footer.credit"
              components={{
                studio: (
                  <a
                    href={STUDIO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline underline-offset-4 hover:text-primary"
                  />
                ),
              }}
            />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href={onHome ? '#contacto' : `${landingHref('home')}#contacto`} className="nav-label text-sm text-muted-foreground hover:text-foreground">
            {t('footer.contact')}
          </a>
          <a href={landingHref('terminos')} className="nav-label text-sm text-muted-foreground hover:text-foreground">
            {t('footer.terms')}
          </a>
          <a href={landingHref('privacidad')} className="nav-label text-sm text-muted-foreground hover:text-foreground">
            {t('footer.privacy')}
          </a>
          <a href={landingHref('baja-servicio')} className="nav-label text-sm text-muted-foreground hover:text-foreground">
            {t('footer.cancellation')}
          </a>
          <a href={LOGIN_URL} className="nav-label text-sm text-muted-foreground hover:text-foreground">
            {t('nav.login')}
          </a>
          <span className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
