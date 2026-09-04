import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUserResponse, ProjectSummary } from '@luma/shared';
import { projectStore, tokenStore } from '@/lib/api-client';

interface SessionState {
  user: AuthUserResponse | null;
  projectId: string | null;
  setSession: (user: AuthUserResponse, accessToken?: string) => void;
  setProject: (project: ProjectSummary) => void;
  clear: () => void;
}

/**
 * Sesión del cliente.
 *
 * El token NO vive acá: vive en `tokenStore` (localStorage) porque el
 * api-client lo necesita fuera de React, en el reintento tras un 401. Este
 * store guarda quién es la persona y en qué proyecto está parada.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      projectId: null,
      setSession: (user, accessToken) => {
        if (accessToken) tokenStore.set(accessToken);
        if (user.project_id) projectStore.set(user.project_id);
        set({ user, projectId: user.project_id ?? null });
      },
      setProject: (project) => {
        projectStore.set(project.id);
        set((state) => ({
          projectId: project.id,
          user: state.user
            ? { ...state.user, project_id: project.id, project_role: project.role }
            : null,
        }));
      },
      clear: () => {
        tokenStore.clear();
        projectStore.clear();
        set({ user: null, projectId: null });
      },
    }),
    { name: 'luma-session', storage: createJSONStorage(() => localStorage) },
  ),
);

export function useCurrentProjectId(): string {
  const projectId = useSessionStore((s) => s.projectId);
  // Las páginas de la app sólo se montan detrás del guard de proyecto, así que
  // acá siempre hay uno. La string vacía evita propagar `null` por todas las
  // query keys.
  return projectId ?? '';
}
