import type { RemovedProjectNotice } from '@luma/shared';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Le avisa a quien fue invitado a una obra que ya no está: la eliminó su
 * gerente. Sin esto, un cliente que entra a mirar su obra se encuentra con una
 * lista vacía y no sabe si fue un error, si perdió el acceso o si la cuenta
 * está rota. Dice qué pasó y a quién preguntar.
 */
export function RemovedProjectsNotice({ projects }: { projects: RemovedProjectNotice[] }) {
  const { t } = useTranslation();
  if (projects.length === 0) return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-2xl bg-card p-4 text-sm text-card-foreground shadow-surface"
    >
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="flex min-w-0 flex-col gap-1">
        <ul className="flex flex-col gap-0.5">
          {projects.map((project) => (
            <li key={project.id} className="font-medium">
              {t('project.removed.title', { name: project.name })}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground">{t('project.removed.contact')}</p>
      </div>
    </div>
  );
}
