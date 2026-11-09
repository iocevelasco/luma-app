import { useEffect, useMemo, useState } from 'react';
import { Rocket, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { DASHBOARD_DESTINATIONS } from '@/components/dashboard/navigation/dashboard-destinations';
import { projectGroupTextKeys, projectNavGroups } from '@/components/dashboard/navigation/project-nav-items';
import { SpotlightTour, type TourStep } from '@/components/onboarding/spotlight-tour';
import { useCurrentUser } from '@/hooks/auth/use-auth-queries';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject, useProjects } from '@/hooks/projects/use-project-queries';
import { hasSeenTour, markTourSeen, type TourLevel } from '@/lib/onboarding-seen';
import { ROUTES } from '@/lib/routes';

/**
 * Recorrido de bienvenida en dos niveles, señalando cada sección en el riel:
 *
 * 1. `home` — la primera vez que se entra al inicio del panel (`/admin`): qué es cada
 *    destino (Obras, Proveedores, Depósito, Empleados) y, al final, la invitación a crear
 *    la primera obra apuntando al botón de "Nueva obra".
 * 2. `project` — la primera vez que se entra a una obra (a cualquiera de sus pantallas, menos
 *    los formularios de alta), **una sola vez, en cualquier obra**: qué es cada sección de la
 *    obra, sólo las que este rol puede ver. Con el alta guiada, la primera obra termina en
 *    Actividades y no en el detalle, así que no se ata a una pantalla.
 *
 * Playwright (`navigator.webdriver`) no lo ve: una capa modal en la primera visita de
 * cada cuenta de prueba voltearía los E2E, que no recorren esto.
 */
export function OnboardingTour() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data } = useCurrentUser();
  const userId = data?.user.id;
  // Los Términos van primero: el recorrido es una capa modal y los taparía. Al aceptarlos,
  // `useAcceptTerms` actualiza esta caché y arranca solo.
  const termsPending = data?.user.terms_pending === true;
  const projectId = useCurrentProjectId();
  const { data: projectData } = useProject(projectId);
  const { data: projectsData } = useProjects();
  // Sólo a quien la API marca como alguien que llegó a crear su primera obra (`firstProjectPrompt`).
  const invitedToCreate = projectsData?.firstProjectPrompt === true;
  const [level, setLevel] = useState<TourLevel | null>(null);

  const isForm = pathname.endsWith('/nuevo') || pathname.endsWith('/nueva');
  const here: TourLevel | null = pathname === ROUTES.ADMIN ? 'home' : projectId && !isForm ? 'project' : null;
  const capabilities = projectData?.project.capabilities;

  const projectsLoaded = projectsData !== undefined;

  useEffect(() => {
    // Si se salió de la pantalla del recorrido (el listado vacío rebota al alta), se cierra:
    // sus pasos apuntan a elementos que ya no están.
    if (level && level !== here) setLevel(null);
    if (!userId || !here || termsPending || typeof navigator === 'undefined' || navigator.webdriver) return;
    // Cada nivel espera sus datos: el de la obra, los permisos (explica sólo lo que se ve);
    // el de inicio, el listado (la invitación a crear la primera obra es sólo para quien no
    // tiene ninguna, y los pasos no pueden cambiar de cantidad con el recorrido abierto).
    if (here === 'project' && !capabilities) return;
    if (here === 'home' && !projectsLoaded) return;
    if (!hasSeenTour(here, userId)) setLevel(here);
  }, [userId, here, termsPending, capabilities, projectsLoaded, level]);

  const steps = useMemo<TourStep[]>(() => {
    if (level === 'home') {
      return [
        { id: 'welcome', icon: Sparkles, title: t('tour.welcomeTitle'), body: t('tour.welcomeBody') },
        ...DASHBOARD_DESTINATIONS.map<TourStep>((destination) => ({
          id: destination.labelKey,
          target: `[data-testid="${destination.testId}"], [data-testid="${destination.testId}-mobile"]`,
          icon: destination.icon,
          title: t(`layout.${destination.labelKey}`),
          body: t(`layout.hints.${destination.labelKey}`),
        })),
        // La invitación a crear la primera obra, sólo a quien todavía no tiene ninguna.
        ...(!invitedToCreate
          ? []
          : [
              {
                id: 'first-project',
                target: '[data-testid="primary-action"]',
                icon: Rocket,
                title: t('tour.finalTitle'),
                body: t('tour.finalBody'),
                cta: {
                  label: t('tour.create'),
                  icon: Rocket,
                  onPress: () => {
                    if (userId) markTourSeen('home', userId);
                    setLevel(null);
                    navigate(ROUTES.PROJECT_NEW);
                  },
                },
              } satisfies TourStep,
            ]),
      ];
    }
    if (level === 'project' && capabilities) {
      return [
        { id: 'intro', icon: Sparkles, title: t('tour.projectTitle'), body: t('tour.projectIntro') },
        ...projectNavGroups(capabilities).map<TourStep>((entry) => {
          const text = projectGroupTextKeys(entry);
          return {
            id: entry.group,
            target: `[data-testid="project-group-${entry.group}"], [data-tour-group="${entry.group}"]`,
            icon: entry.icon,
            title: t(text.label),
            body: t(text.hint),
          };
        }),
      ];
    }
    return [];
  }, [level, capabilities, invitedToCreate, navigate, t, userId]);

  if (!level || !userId || termsPending || steps.length === 0) return null;

  return (
    <SpotlightTour
      key={level}
      steps={steps}
      onClose={() => {
        markTourSeen(level, userId);
        setLevel(null);
      }}
    />
  );
}
