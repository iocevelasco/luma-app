import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDrawer } from '@/components/common/form-drawer';
import { Checkbox } from '@/components/ui/checkbox';
import { useProjects } from '@/hooks/projects/use-project-queries';

/**
 * En qué obras está un proveedor o un empleado de la Empresa. Casillas sobre
 * todas las obras: lo que ves es lo que queda, y se manda la lista completa.
 *
 * Sacar a alguien de una obra donde ya trabaja lo rechaza la API (409); el
 * mensaje llega por el banner del form, junto al botón que se acaba de apretar.
 */
export function ProjectAssignmentDialog({
  open,
  onOpenChange,
  title,
  initialProjectIds,
  isSubmitting,
  error,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialProjectIds: string[];
  isSubmitting: boolean;
  error: unknown;
  onSave: (projectIds: string[]) => void;
}) {
  const { t } = useTranslation();
  const { data } = useProjects();
  const projects = (data?.projects ?? []).filter((project) => project.status !== 'archived');
  const [selected, setSelected] = useState<Set<string>>(new Set(initialProjectIds));

  // Al abrir sobre otra persona, parte de lo que ésa ya tiene.
  useEffect(() => {
    if (open) setSelected(new Set(initialProjectIds));
  }, [open, initialProjectIds]);

  function toggle(projectId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={t('directory.projectsHint')}
      size="md"
      submitLabel={t('directory.projectsSave')}
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={(event) => {
        event.preventDefault();
        onSave([...selected]);
      }}
    >
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('directory.noProjects')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <Checkbox
                  checked={selected.has(project.id)}
                  onCheckedChange={() => toggle(project.id)}
                />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </FormDrawer>
  );
}
