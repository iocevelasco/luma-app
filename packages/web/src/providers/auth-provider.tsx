import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { hasPermission, type Permission, type ProjectRole, type ProjectSummary } from '@luma/shared';
import { authApi } from '@/api';
import { tokenStore } from '@/lib/api-client';
import { useSessionStore } from '@/stores/session-store';

interface AuthContextValue {
  loading: boolean;
  isAuthenticated: boolean;
  role: ProjectRole | null;
  /**
   * `can()` lee la MISMA matriz que el backend (`ROLE_PERMISSIONS` en shared).
   * Por eso una pantalla nunca ofrece un botón que la API va a rechazar: no
   * hay dos listas que puedan divergir.
   */
  can: (permission: Permission) => boolean;
  switchProject: (project: ProjectSummary) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, setSession, setProject, clear } = useSessionStore();
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setSession(me);
    } catch {
      // El api-client ya intentó renovar con la cookie de refresh. Si igual
      // falló, la sesión no existe: se limpia y se sigue como anónimo.
      clear();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      isAuthenticated: !!user,
      role: user?.project_role ?? null,
      can: (permission) => hasPermission(user?.project_role ?? undefined, permission),
      switchProject: async (project) => {
        const session = await authApi.switchProject(project.id);
        setSession(session.user, session.accessToken);
        setProject(project);
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          clear();
        }
      },
      refresh: load,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return context;
}
