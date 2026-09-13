import { useTranslation } from 'react-i18next';
import { LOGIN_URL } from '../lib/app-url';

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-hairline bg-canvas-light px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <span className="font-serif text-base font-bold text-ink-on-light">
          {t('brand')}
          <span className="hanko" aria-hidden="true" />
        </span>

        <div className="flex items-center gap-6">
          <a href={LOGIN_URL} className="nav-label text-xs text-body-on-light hover:text-ink-on-light">
            {t('nav.login')}
          </a>
          <span className="font-mono text-xs text-body-on-light">
            © {new Date().getFullYear()}
          </span>
        </div>
      </div>
    </footer>
  );
}
