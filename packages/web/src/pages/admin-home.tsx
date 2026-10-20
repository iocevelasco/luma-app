import { useState } from 'react';
import { format } from 'date-fns';
import type { Project } from '@luma/shared';
import { HardHat, MapPin, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fromDayKey } from '@/components/common/date-range-filter';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useProjects } from '@/hooks/projects/use-project-queries';
import { ROUTES, projectActivitiesPath } from '@/lib/routes';
import { ActivatePlanDialog } from '@/components/subscription/activate-plan-dialog';
import { BolivaresPaymentDrawer } from '@/components/subscription/bolivares-payment-drawer';
import { useMySubscription } from '@/hooks/subscription/use-subscription-queries';
import { nextProjectState } from '@/lib/subscription';

/**
 * Una obra, como tarjeta. Toda la tarjeta es el enlace: un nombre clickeable
 * de 20px dentro de una caja de 200 obliga a apuntar, y esta es la pantalla
 * desde la que se entra a trabajar.
 */
function ProjectCard({ project }: { project: Project }) {
  const dateLocale = useDateLocale();

  return (
    <Link
      to={projectActivitiesPath(project.id)}
      className="flex-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader>
          <CardTitle className="text-base leading-snug">{project.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{project.location}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {format(fromDayKey(project.estimatedStartDate), 'PP', { locale: dateLocale })}
            {' – '}
            {format(fromDayKey(project.estimatedEndDate), 'PP', { locale: dateLocale })}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Home del panel: las obras, en tarjetas.
 *
 * Era una tabla con cuatro columnas. Una obra no es una fila de datos que se
 * compara con la de al lado: es un lugar al que se entra, y son pocas. La
 * tarjeta da un blanco grande para el dedo y deja lugar para lo que esta
 * pantalla va a querer mostrar después —avance, próximo pago— sin sumar
 * columnas que en mobile no entran.
 *
 * Sin obras no se muestra nada más que la invitación a crear la primera: la
 * sección de Empresa y el resto del chrome delante de un panel vacío son
 * ruido en el único momento en que la pantalla tiene una sola cosa para
 * decir.
 */
export function AdminHomePage() {
  const { t } = useTranslation();
  const { data, isLoading } = useProjects();
  const { data: subscription } = useMySubscription();
  const [activating, setActivating] = useState(false);
  const [payingInBolivares, setPayingInBolivares] = useState(false);

  const projects = data?.projects ?? [];
  // "Nueva obra" hace lo que corresponde según la suscripción: en la prueba
  // con 3 activas abre el pase al plan (la cuarta no se puede crear gratis)
  // y vencida lleva a pagar. El resto entra al alta como siempre.
  const next = nextProjectState(subscription);
  const newProjectLabel = (
    <>
      <Plus className="size-4" />
      {t('project.list.new')}
    </>
  );

  return (
    <>
    <PageLayout
      width="full"
      isLoading={isLoading}
      action={
        next === 'trialLimit' ? (
          <Button onClick={() => setActivating(true)}>{newProjectLabel}</Button>
        ) : (
          <Button asChild>
            <Link to={next === 'expired' ? ROUTES.SUBSCRIPTION : ROUTES.PROJECT_NEW}>
              {newProjectLabel}
            </Link>
          </Button>
        )
      }
      empty={
        projects.length === 0
          ? {
              icon: HardHat,
              title: t('project.list.emptyTitle'),
              description: t('project.list.emptyBody'),
            }
          : undefined
      }
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
        {projects.map((project) => (
          <li key={project.id} className="flex">
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    </PageLayout>
    {subscription && (
      <ActivatePlanDialog
        open={activating}
        onOpenChange={setActivating}
        subscription={subscription}
        onPayInBolivares={() => setPayingInBolivares(true)}
      />
    )}
    <BolivaresPaymentDrawer
      open={payingInBolivares}
      onOpenChange={setPayingInBolivares}
      activateNow
    />
    </>
  );
}

export default AdminHomePage;
