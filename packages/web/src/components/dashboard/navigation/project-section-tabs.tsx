import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useViewTabsSlot } from '@/components/layout/view-tabs-slot-context';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';
import { isProjectSectionActive, projectNavGroups } from './project-nav-items';

/**
 * Las secciones del grupo en el que se está, como pestañas arriba de la
 * pantalla (desktop). El riel lleva al grupo; acá se elige la sección.
 *
 * Un grupo con una sola sección visible (Resumen, o "Contaduría" para quien sólo
 * ve cobros) no muestra pestañas: una pestaña sola no elige nada. Se ve igual en
 * mobile: ahí la tira de `ProjectNavScroller` lista los mismos grupos que el riel.
 */
export function ProjectSectionTabs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const projectId = useCurrentProjectId();
  const { data } = useProject(projectId);
  const { setSlot } = useViewTabsSlot();

  if (!projectId) return null;

  const entry = projectNavGroups(data?.project.capabilities ?? []).find(({ items }) =>
    items.some((item) => isProjectSectionActive(item, projectId, pathname)),
  );
  if (!entry || entry.items.length < 2) return null;

  const active = entry.items.find((item) => isProjectSectionActive(item, projectId, pathname));

  return (
    <div className="mb-4 flex max-w-full flex-wrap items-center gap-x-3 gap-y-2">
      <div className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Tabs value={active?.labelKey}>
          <TabsList aria-label={t(`project.nav.groups.${entry.group}`)}>
            {entry.items.map(({ labelKey, icon, path }) => (
              <TabsTrigger
                key={labelKey}
                value={labelKey}
                // Enlace de verdad: clic medio, Cmd+clic y copiar la dirección andan; la navegación
                // la hace el `RouterProvider` del layout.
                href={path(projectId)}
                icon={icon}
                data-testid={`project-nav-${labelKey}`}
              >
                {t(`project.nav.${labelKey}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      {/* Las pestañas de vista de la pantalla (`PageLayout viewTabs`) van acá, en la misma fila. */}
      <div ref={setSlot} className="contents" />
    </div>
  );
}
