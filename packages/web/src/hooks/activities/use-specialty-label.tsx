import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { CUSTOM_SPECIALTY_PREFIX, type ProjectCustomSpecialty } from '@luma/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useCurrentProjectId } from '@/hooks/projects/use-current-project-id';
import { useProject } from '@/hooks/projects/use-project-queries';

type SpecialtyLabeler = (key: string) => string;

/**
 * Cómo se llama una especialidad: las de base salen de i18n y las propias, del
 * nombre que el gerente les puso. Sin la obra a mano (todavía cargando, o una
 * pantalla fuera de ella) una propia se muestra con su clave legible
 * ("custom_yeseria_fina" → "Yeseria fina"), nunca con un texto genérico.
 */
export function specialtyLabelFor(
  key: string,
  custom: readonly ProjectCustomSpecialty[] | undefined,
  t: TFunction,
): string {
  if (!key.startsWith(CUSTOM_SPECIALTY_PREFIX)) return t(`provider.specialty.${key}`);
  const found = custom?.find((item) => item.key === key)?.label;
  if (found) return found;
  const readable = key.slice(CUSTOM_SPECIALTY_PREFIX.length).replace(/_/g, ' ');
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

const SpecialtyLabelContext = createContext<SpecialtyLabeler | null>(null);

/**
 * Resuelve la función de rótulos **una vez** para toda la pantalla de una obra.
 * Cada tarjeta, fila y celda del Gantt la lee del contexto en vez de repetir la
 * búsqueda de la ruta y la suscripción a la obra por su cuenta.
 */
export function SpecialtyLabelProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const projectId = useCurrentProjectId();
  const { data } = useProject(projectId);
  const custom = data?.project.customSpecialties;
  const label = useCallback((key: string) => specialtyLabelFor(key, custom, t), [custom, t]);
  return <SpecialtyLabelContext.Provider value={label}>{children}</SpecialtyLabelContext.Provider>;
}

export function useSpecialtyLabel(): SpecialtyLabeler {
  const fromContext = useContext(SpecialtyLabelContext);
  const { t } = useTranslation();
  const fallback = useCallback((key: string) => specialtyLabelFor(key, undefined, t), [t]);
  return fromContext ?? fallback;
}
