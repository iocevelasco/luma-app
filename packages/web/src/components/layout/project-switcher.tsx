import { useNavigate } from 'react-router-dom';
import { PROJECT_ROLE_LABELS } from '@luma/shared';
import { useProjects } from '@/hooks';
import { useAuth } from '@/providers/auth-provider';
import { useSessionStore } from '@/stores/session-store';
import { Select } from '@/components/ui';
import { ROUTES } from '@/lib/routes';

/**
 * Cambio de proyecto.
 *
 * No es sólo cambiar una variable local: re-emite los tokens con el nuevo
 * scope, porque el rol de la persona puede ser distinto en cada proyecto —
 * ejecutante en la suya, cliente en la de otro.
 */
export function ProjectSwitcher({ compact = false }: { compact?: boolean }) {
  const { data: projects } = useProjects();
  const { switchProject } = useAuth();
  const user = useSessionStore((s) => s.user);
  const navigate = useNavigate();

  const current = projects?.find((p) => p.id === user?.project_id);

  if (!projects || projects.length === 0) return null;

  if (projects.length === 1) {
    return (
      <div className={compact ? 'min-w-0' : ''}>
        <p className="truncate text-sm font-medium">{current?.name ?? projects[0].name}</p>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            {PROJECT_ROLE_LABELS[current?.role ?? projects[0].role]}
          </p>
        )}
      </div>
    );
  }

  return (
    <Select
      aria-label="Proyecto activo"
      value={user?.project_id ?? ''}
      className={compact ? 'h-9 max-w-[60vw] text-sm' : 'h-9 text-sm'}
      onChange={(event) => {
        const project = projects.find((p) => p.id === event.target.value);
        if (!project) return;
        void switchProject(project).then(() => {
          // Un cliente y un ejecutante no comparten pantalla de inicio.
          navigate(project.role === 'client' ? ROUTES.CLIENT_HOME : ROUTES.HOME);
        });
      }}
    >
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </Select>
  );
}
