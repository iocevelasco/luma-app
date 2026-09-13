import { useTranslation } from 'react-i18next';
import { LOGIN_URL } from '../lib/app-url';

export function Nav() {
  const { t, i18n } = useTranslation();
  const current = i18n.language.startsWith('pt') ? 'pt' : 'es';

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-canvas-light/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <a href="#top" className="font-serif text-lg font-bold text-ink-on-light">
          {t('brand')}
          <span className="hanko" aria-hidden="true" />
        </a>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1" role="group" aria-label={t('nav.language')}>
            {(['es', 'pt'] as const).map((lng) => (
              <button
                key={lng}
                type="button"
                onClick={() => i18n.changeLanguage(lng)}
                aria-pressed={current === lng}
                className={`nav-label px-2 py-1 text-xs ${
                  current === lng ? 'text-ink-on-light' : 'text-body-on-light'
                }`}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>

          <a
            href={LOGIN_URL}
            className="cta-label rounded-edge bg-red-ink px-4 py-2 text-xs text-white transition-colors hover:bg-red-deep"
          >
            {t('nav.login')}
          </a>
        </div>
      </nav>
    </header>
  );
}
