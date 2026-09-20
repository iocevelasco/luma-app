import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/dashboard-layout';
import { AuthenticatedLayout, PublicOnlyLayout } from './components/route-layouts';
import { RouteLoading } from './components/routes/route-loading';
import { ROUTES } from './lib/routes';

// Todas las páginas en lazy: la pantalla de login no tiene por qué bajar el
// bundle del panel, ni al revés.
const LoginPage = lazy(() => import('./pages/login').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() =>
  import('./pages/register').then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/forgot-password').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/reset-password').then((m) => ({ default: m.ResetPasswordPage })),
);
const ActivatePage = lazy(() =>
  import('./pages/activate').then((m) => ({ default: m.ActivatePage })),
);
const CheckEmailPage = lazy(() =>
  import('./pages/check-email').then((m) => ({ default: m.CheckEmailPage })),
);
const VerifyEmailPage = lazy(() =>
  import('./pages/verify-email').then((m) => ({ default: m.VerifyEmailPage })),
);
const ConfirmEmailChangePage = lazy(() =>
  import('./pages/confirm-email-change').then((m) => ({ default: m.ConfirmEmailChangePage })),
);
const AdminHomePage = lazy(() =>
  import('./pages/admin-home').then((m) => ({ default: m.AdminHomePage })),
);
const AccountSettingsPage = lazy(() =>
  import('./pages/account-settings').then((m) => ({ default: m.AccountSettingsPage })),
);
const ProjectNewPage = lazy(() =>
  import('./pages/projects/project-new').then((m) => ({ default: m.ProjectNewPage })),
);
const ProjectDetailPage = lazy(() =>
  import('./pages/projects/project-detail').then((m) => ({ default: m.ProjectDetailPage })),
);
const ProjectActivitiesPage = lazy(() =>
  import('./pages/projects/project-activities').then((m) => ({
    default: m.ProjectActivitiesPage,
  })),
);
const ProjectMaterialsPage = lazy(() =>
  import('./pages/projects/project-materials').then((m) => ({ default: m.ProjectMaterialsPage })),
);
const ProjectLaborPage = lazy(() =>
  import('./pages/projects/project-labor').then((m) => ({ default: m.ProjectLaborPage })),
);
const NotFoundPage = lazy(() =>
  import('./pages/not-found').then((m) => ({ default: m.NotFoundPage })),
);

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Públicas que además echan a quien ya tiene sesión. */}
      <Route element={<PublicOnlyLayout />}>
        <Route path={ROUTES.LOGIN} element={<LazyRoute><LoginPage /></LazyRoute>} />
        <Route path={ROUTES.REGISTER} element={<LazyRoute><RegisterPage /></LazyRoute>} />
        <Route
          path={ROUTES.FORGOT_PASSWORD}
          element={<LazyRoute><ForgotPasswordPage /></LazyRoute>}
        />
      </Route>

      {/* Públicas que valen con sesión o sin ella: las abre un enlace de un mail. */}
      <Route path={ROUTES.RESET_PASSWORD} element={<LazyRoute><ResetPasswordPage /></LazyRoute>} />
      <Route path={ROUTES.ACTIVATE} element={<LazyRoute><ActivatePage /></LazyRoute>} />
      <Route path={ROUTES.CHECK_EMAIL} element={<LazyRoute><CheckEmailPage /></LazyRoute>} />
      <Route path={ROUTES.VERIFY_EMAIL} element={<LazyRoute><VerifyEmailPage /></LazyRoute>} />
      <Route
        path={ROUTES.CONFIRM_EMAIL_CHANGE}
        element={<LazyRoute><ConfirmEmailChangePage /></LazyRoute>}
      />

      {/*
        Panel. El chrome se monta una sola vez, arriba del Outlet. Cualquier
        autenticado entra acá — no hay gate de admin: `role: 'admin'` es un
        concepto de plataforma sin ninguna pantalla propia todavía, no el
        rol de quien gestiona sus obras.
      */}
      <Route element={<AuthenticatedLayout />}>
        <Route element={<DashboardLayout />}>
          <Route path={ROUTES.ADMIN} element={<LazyRoute><AdminHomePage /></LazyRoute>} />
          <Route
            path={ROUTES.ACCOUNT_SETTINGS}
            element={<LazyRoute><AccountSettingsPage /></LazyRoute>}
          />
          <Route path={ROUTES.PROJECT_NEW} element={<LazyRoute><ProjectNewPage /></LazyRoute>} />
          <Route
            path={ROUTES.PROJECT_DETAIL}
            element={<LazyRoute><ProjectDetailPage /></LazyRoute>}
          />
          <Route
            path={ROUTES.PROJECT_ACTIVITIES}
            element={<LazyRoute><ProjectActivitiesPage /></LazyRoute>}
          />
          <Route
            path={ROUTES.PROJECT_MATERIALS}
            element={<LazyRoute><ProjectMaterialsPage /></LazyRoute>}
          />
          <Route
            path={ROUTES.PROJECT_LABOR}
            element={<LazyRoute><ProjectLaborPage /></LazyRoute>}
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={ROUTES.ADMIN} replace />} />
      <Route path={ROUTES.NOT_FOUND} element={<LazyRoute><NotFoundPage /></LazyRoute>} />
    </Routes>
  );
}
