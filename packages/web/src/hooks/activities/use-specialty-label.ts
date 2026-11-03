import { useCallback } from 'react';
import { CUSTOM_SPECIALTY_PREFIX } from '@luma/shared';
import { useTranslation } from 'react-i18next';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';

/**
 * Cómo se llama una especialidad de tarea en la obra que se está mirando: las de
 * base salen de i18n y las propias, del nombre que el gerente les puso. Una
 * función que no depende de la pantalla evita que cada una resuelva el rótulo a
 * su manera y que una especialidad propia aparezca como una clave cruda.
 */
export function useSpecialtyLabel(): (key: string) => string {
  const { t } = useTranslation();
  const projectId = useCurrentProjectId();
  const { data } = useProject(projectId);
  const custom = data?.project.customSpecialties;

  return useCallback(
    (key: string) => {
      if (!key.startsWith(CUSTOM_SPECIALTY_PREFIX)) return t(`provider.specialty.${key}`);
      return custom?.find((item) => item.key === key)?.label ?? t('specialty.unknown');
    },
    [custom, t],
  );
}
