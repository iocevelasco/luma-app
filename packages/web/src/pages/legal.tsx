import { LEGAL_CONTACT_EMAIL, LEGAL_VERSION } from '@luma/shared';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AppLogo } from '@/components/app-logo';
import { ROUTES } from '@/lib/routes';

interface LegalSection {
  title: string;
  paragraphs: string[];
}

/**
 * Términos de uso y Política de Privacidad, un solo documento. Pública: se lee
 * antes de tener cuenta, y la landing enlaza acá para que el texto viva en un
 * solo lugar. El contenido está en i18n; la versión vigente, en `@luma/shared`.
 */
export function LegalPage() {
  const { t } = useTranslation();
  const sections = t('legal.page.sections', { returnObjects: true }) as LegalSection[];

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
            {t('legal.page.back')}
          </Link>
        </div>

        <header className="flex flex-col gap-3">
          <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">
            {t('legal.page.title')}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {t('legal.page.version', { version: LEGAL_VERSION })}
          </p>
          <p className="text-base leading-relaxed text-muted-foreground">
            {t('legal.page.intro')}
          </p>
        </header>

        {sections.map((section) => (
          <section key={section.title} className="flex flex-col gap-3">
            <h2 className="text-xl font-medium">{section.title}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </section>
        ))}

        {LEGAL_CONTACT_EMAIL && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t('legal.page.contact', { email: LEGAL_CONTACT_EMAIL })}
          </p>
        )}
      </div>
    </div>
  );
}

export default LegalPage;
