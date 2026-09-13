import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { RouteLoading } from '@/components/routes/route-loading';
import { isAdmin } from '@/lib/roles';
import { buildLoginPathWithReturn, readReturnTo } from '@/lib/return-to';
import { ROUTES } from '@/lib/routes';
import { useAuth } from '@/providers/auth-provider';

/**
 * Los guards sólo deciden quién pasa. No montan chrome ni providers: eso vive
 * en el layout de la sección, para que cambiar de pestaña no remonte el árbol.
 */

/** Saca de encima a quien ya está logueado (pantallas de login, registro…). */
export function PublicOnlyLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <RouteLoading />;

  if (isAuthenticated) {
    // Un returnTo validado gana sobre el destino por rol: si la persona venía
    // de un enlace profundo, ahí es donde quería estar.
    const returnTo = readReturnTo(location.search);
    return <Navigate to={returnTo ?? ROUTES.ADMIN} replace />;
  }

  return <Outlet />;
}

/** Manda a login a quien no tiene sesión, recordando adónde iba. */
export function AuthenticatedLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <RouteLoading />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to={buildLoginPathWithReturn(ROUTES.LOGIN, location.pathname + location.search)}
        replace
      />
    );
  }

  return <Outlet />;
}

/** Sólo admin. Va anidado dentro de AuthenticatedLayout. */
export function AdminLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <RouteLoading />;
  if (!isAdmin(user?.role)) return <Navigate to={ROUTES.LOGIN} replace />;

  return <Outlet />;
}
