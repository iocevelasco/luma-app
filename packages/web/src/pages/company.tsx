import { OrganizationProfile, TeamSection } from '@/components/organization/organization-panel';

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
  return (
    <div className="flex flex-col gap-6 p-3 md:p-4">
      <OrganizationProfile />
      <TeamSection />
    </div>
  );
}

export default CompanyPage;
