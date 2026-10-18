import { Trans, useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { LOGIN_URL } from '../lib/app-url';

const STUDIO_URL = 'https://www.instagram.com/ido.arquitectura/';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-border bg-card px-6 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <Logo />
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

        <div className="flex items-center gap-6">
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
