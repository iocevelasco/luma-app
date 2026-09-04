import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';
import { useSessionStore } from '@/stores/session-store';
import { Spinner } from '@/components/ui';

function FullScreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-6 w-6 text-muted-foreground" />
    </div>
  );
}

/** Sólo decide quién pasa. Nada de UI de layout acá. */
export function RequireAuth() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenSpinner />;
  if (!isAuthenticated) {
    // Se guarda a dónde iba: después del login vuelve ahí y no al panel.
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

/**
 * Guard del área de gestión.
 *
 * Un cliente que entra por un link interno cae en su propia vista, no en un
 * 403: el error no es suyo, es del link.
 */
export function RequireTeamRole() {
  const user = useSessionStore((s) => s.user);

  if (!user?.project_id) return <Navigate to={ROUTES.PROJECTS} replace />;
  if (user.project_role === 'client') return <Navigate to={ROUTES.CLIENT_HOME} replace />;
  return <Outlet />;
}

export function RequireClientRole() {
  const user = useSessionStore((s) => s.user);

  if (!user?.project_id) return <Navigate to={ROUTES.PROJECTS} replace />;
  if (user.project_role !== 'client') return <Navigate to={ROUTES.HOME} replace />;
  return <Outlet />;
}
