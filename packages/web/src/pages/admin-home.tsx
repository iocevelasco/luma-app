import { useId, useState } from 'react';
import { format, formatDistanceStrict, formatDistanceToNowStrict } from 'date-fns';
import type { Project } from '@luma/shared';
import { ArrowRight, HardHat, MapPin, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { fromDayKey, toDayKey } from '@/components/common/date-range-filter';
import { RemovedProjectsNotice } from '@/components/projects/removed-projects-notice';
import { PageLayout } from '@/components/layout/page-layout';
import { Button } from '@/components/ui/button';
import { useDateLocale } from '@/hooks/use-date-locale';
import { useDeletedProjects, useProjects } from '@/hooks/projects/use-project-queries';
import { ROUTES, projectActivitiesPath } from '@/lib/routes';
import { cn } from '@/lib/utils';
import { ActivatePlanDialog } from '@/components/subscription/activate-plan-dialog';
import { BolivaresPaymentDrawer } from '@/components/subscription/bolivares-payment-drawer';
import { useMySubscription } from '@/hooks/subscription/use-subscription-queries';
import { nextProjectState } from '@/lib/subscription';

/** Dónde está una obra en el tiempo, según sus fechas estimadas. No se guarda: se calcula. */
type ProjectPhase = 'upcoming' | 'active' | 'done';

const PHASE_DOT: Record<ProjectPhase, string> = {
  upcoming: 'bg-warning',
  active: 'bg-primary',
  done: 'bg-muted-foreground',
};

/**
 * Una obra, como tarjeta. Toda la tarjeta es el enlace: un nombre clickeable
 * de 20px dentro de una caja de 200 obliga a apuntar, y esta es la pantalla
 * desde la que se entra a trabajar.
 *
 * Es la pieza más central de la app, así que tiene su propio lenguaje: oscura,
 * sombreada de arriba hacia abajo y con textura de puntos (`luma-project-card`),
 * con el orden de una tarjeta de referencia —la marca y el estado arriba, lo que
 * es en el medio, el dato y la acción al pie— y un solo nivel que compite por la
 * mirada: el nombre de la obra. El "Abrir" del pie no es un botón sino la forma
 * de uno: el botón dentro de un enlace anidaría dos controles, y la tarjeta
 * entera ya es el enlace.
 */
function ProjectCard({ project }: { project: Project }) {
  const { t } = useTranslation();
  const dateLocale = useDateLocale();
  const titleId = useId();

  const start = fromDayKey(project.estimatedStartDate);
  const end = fromDayKey(project.estimatedEndDate);
  const today = toDayKey(new Date());
  const phase: ProjectPhase =
    today < project.estimatedStartDate ? 'upcoming' : today > project.estimatedEndDate ? 'done' : 'active';
  const distance = (date: Date) => formatDistanceToNowStrict(date, { addSuffix: true, locale: dateLocale });
  const caption =
    phase === 'upcoming'
      ? t('project.card.startsIn', { distance: distance(start) })
      : phase === 'active'
        ? t('project.card.endsIn', { distance: distance(end) })
        : t('project.card.endedAgo', { distance: distance(end) });
  const chipClass = 'inline-flex items-center rounded-md bg-foreground/10 px-2.5 py-1 text-xs text-foreground';

  return (
    <Link
      to={projectActivitiesPath(project.id)}
      // El enlace se llama como la obra. Sin esto Chromium lo deja sin nombre: no
      // lo calcula desde el contenido cuando adentro hay un `article`, y un lector de
      // pantalla leería "enlace" a secas.
      aria-labelledby={titleId}
      className="group flex-1 rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="luma-project-card surface-dark flex h-full flex-col gap-5 rounded-3xl p-5 text-foreground shadow-surface transition-transform duration-300 group-hover:-translate-y-0.5">
        {/* Arriba: la marca de la obra y en qué momento está, como una pastilla translúcida. */}
        <div className="flex items-start justify-between gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-md bg-foreground/10">
            <HardHat className="size-5" />
          </span>
          <span className={cn(chipClass, 'gap-1.5')}>
            <span aria-hidden className={cn('size-1.5 rounded-full', PHASE_DOT[phase])} />
            {t(`project.card.phase.${phase}`)}
          </span>
        </div>

        {/* En el medio, qué es: dónde, con cuánto falta al lado, y el nombre, grande. */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="flex min-w-0 items-center gap-1.5 text-base">
              <MapPin aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{project.location}</span>
            </span>
            <span className="text-xs text-muted-foreground">{caption}</span>
          </div>
          <h2 id={titleId} className="text-2xl font-medium leading-tight break-words">
            {project.name}
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={chipClass}>{project.currency}</span>
          {project.size && <span className={chipClass}>{project.size}</span>}
        </div>

        <div aria-hidden className="mt-auto h-px bg-foreground/15" />

        {/* Al pie: las fechas, que es lo que se compara entre obras, y la forma de entrar. */}
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight tabular-nums">
              {format(start, 'PP', { locale: dateLocale })}
              {' – '}
              {format(end, 'PP', { locale: dateLocale })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatDistanceStrict(start, end, { locale: dateLocale })}
            </p>
          </div>
          <span
            aria-hidden
            className="inline-flex h-9 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-colors group-hover:bg-foreground/85"
          >
            {t('project.card.open')}
            <ArrowRight className="size-4" />
          </span>
        </div>
      </article>
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
  const { data: trash } = useDeletedProjects();
  const { data: subscription } = useMySubscription();
  const [activating, setActivating] = useState(false);
  const [payingInBolivares, setPayingInBolivares] = useState(false);

  const projects = data?.projects ?? [];
  const removed = data?.removedProjects ?? [];
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
      secondaryActions={
        trash && trash.projects.length > 0 ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.PROJECTS_TRASH}>
              <Trash2 className="size-4" />
              {t('project.trash.link', { count: trash.projects.length })}
            </Link>
          </Button>
        ) : undefined
      }
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
        projects.length === 0 && removed.length > 0
          ? // Sin obras y con avisos: el aviso ES el contenido, no un vacío con "creá tu primera obra".
            undefined
          : projects.length === 0
          ? {
              icon: HardHat,
              title: t('project.list.emptyTitle'),
              description: t('project.list.emptyBody'),
            }
          : undefined
      }
    >
      <RemovedProjectsNotice projects={removed} />
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
      includeNextProject
    />
    </>
  );
}

export default AdminHomePage;
