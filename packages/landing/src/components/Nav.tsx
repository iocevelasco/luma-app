import { useTranslation } from 'react-i18next';
import { LOGIN_URL } from '../lib/app-url';
import { CTA_PRIMARY } from '../lib/cta';
import { Logo } from './Logo';

const LINKS = [
  { href: '#roles', key: 'roles' },
  { href: '#features', key: 'features' },
  { href: '#how', key: 'how' },
  { href: '#equipo', key: 'team' },
  { href: '#pricing', key: 'pricing' },
  { href: '#faq', key: 'faq' },
] as const;

export function Nav() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" aria-label={t('brand')}>
          <Logo />
        </a>

        <ul className="hidden items-center gap-8 lg:flex">
          {LINKS.map((link) => (
            <li key={link.key}>
              <a
                href={link.href}
                className="nav-label text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(`nav.links.${link.key}`)}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <a
            href={LOGIN_URL}
            className={`${CTA_PRIMARY} h-9 px-4 text-xs`}
          >
            {t('nav.login')}
          </a>
        </div>
      </nav>
    </header>
  );
}
