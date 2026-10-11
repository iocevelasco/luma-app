import { useTranslation } from 'react-i18next';
import { OrganizationName, TeamSection } from '@/components/organization/organization-panel';

/**
 * La Empresa: su nombre y quién la integra.
 *
 * Tiene pantalla propia y no vive al final de la home. Ahí estaba debajo del
 * listado de obras, que crece: con cinco obras ya había que scrollear para
 * encontrar el equipo, y con veinte directamente no existía. Son dos cosas
 * distintas —las obras se miran todos los días, la Empresa se toca cuando
 * entra alguien nuevo— y mezclarlas hacía que la segunda desapareciera.
 */
export function CompanyPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-lg font-medium">{t('layout.company')}</h1>
        <p className="text-sm text-muted-foreground">{t('team.pageSubtitle')}</p>
      </div>

      <OrganizationName />
      <TeamSection />
    </div>
  );
}

export default CompanyPage;
