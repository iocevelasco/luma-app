import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/dashboard-layout';
import { PlatformLayout } from './components/platform/platform-layout';
import { AdminLayout, AuthenticatedLayout, PublicOnlyLayout } from './components/route-layouts';
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
const LegalPage = lazy(() => import('./pages/legal').then((m) => ({ default: m.LegalPage })));
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
const EmployeesPage = lazy(() =>
  import('./pages/employees').then((m) => ({ default: m.EmployeesPage })),
);
const ProvidersDirectoryPage = lazy(() =>
  import('./pages/providers-directory').then((m) => ({ default: m.ProvidersDirectoryPage })),
);
const ProjectsTrashPage = lazy(() =>
  import('./pages/projects/projects-trash').then((m) => ({ default: m.ProjectsTrashPage })),
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
const ProjectProvidersPage = lazy(() =>
  import('./pages/projects/project-providers').then((m) => ({
    default: m.ProjectProvidersPage,
  })),
);
const ProjectPaymentsPage = lazy(() =>
  import('./pages/projects/project-payments').then((m) => ({ default: m.ProjectPaymentsPage })),
);
const ProjectExpensesPage = lazy(() =>
  import('./pages/projects/project-expenses').then((m) => ({ default: m.ProjectExpensesPage })),
);
const ProjectTeamPage = lazy(() =>
  import('./pages/projects/project-team').then((m) => ({ default: m.ProjectTeamPage })),
);
const ProjectMilestonesPage = lazy(() =>
  import('./pages/projects/project-milestones').then((m) => ({
    default: m.ProjectMilestonesPage,
  })),
);
const MilestoneNewPanel = lazy(() =>
  import('./components/milestones/milestone-form-panel').then((m) => ({
    default: m.MilestoneNewPanel,
  })),
);
const MilestoneEditPanel = lazy(() =>
  import('./components/milestones/milestone-form-panel').then((m) => ({
    default: m.MilestoneEditPanel,
  })),
);
const ProjectDocumentsPage = lazy(() =>
  import('./pages/projects/project-documents').then((m) => ({
    default: m.ProjectDocumentsPage,
  })),
);
const ProjectBudgetPage = lazy(() =>
  import('./pages/projects/project-budget').then((m) => ({ default: m.ProjectBudgetPage })),
);
const ProjectAdvisorPage = lazy(() =>
  import('./pages/projects/project-advisor').then((m) => ({ default: m.ProjectAdvisorPage })),
);
const SubscriptionPage = lazy(() =>
  import('./pages/subscription').then((m) => ({ default: m.SubscriptionPage })),
);
const PlatformBillingPage = lazy(() =>
  import('./pages/platform/platform-billing').then((m) => ({ default: m.PlatformBillingPage })),
);
const PlatformUsersPage = lazy(() =>
  import('./pages/platform/platform-users').then((m) => ({ default: m.PlatformUsersPage })),
);
const PlatformActivityPage = lazy(() =>
  import('./pages/platform/platform-activity').then((m) => ({ default: m.PlatformActivityPage })),
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
      <Route path={ROUTES.LEGAL} element={<LazyRoute><LegalPage /></LazyRoute>} />
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
          {/* Empresa se unificó con Empleados; los datos de la Empresa están en la cuenta. */}
          <Route path={ROUTES.COMPANY} element={<Navigate to={ROUTES.CREW} replace />} />
          <Route
            path={ROUTES.PROVIDERS}
            element={<LazyRoute><ProvidersDirectoryPage /></LazyRoute>}
          />
          <Route path={ROUTES.CREW} element={<LazyRoute><EmployeesPage /></LazyRoute>} />
          <Route
            path={ROUTES.SUBSCRIPTION}
            element={<LazyRoute><SubscriptionPage /></LazyRoute>}
          />
          {/* La cola de pagos vivía acá: quien tenga el enlace viejo guardado llega igual. */}
          <Route
            path={ROUTES.LEGACY_PLATFORM_BILLING}
            element={<Navigate to={ROUTES.PLATFORM_BILLING} replace />}
          />
          <Route path={ROUTES.PROJECT_NEW} element={<LazyRoute><ProjectNewPage /></LazyRoute>} />
          <Route
            path={ROUTES.PROJECTS_TRASH}
            element={<LazyRoute><ProjectsTrashPage /></LazyRoute>}
          />
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
          <Route
            path={ROUTES.PROJECT_PROVIDERS}
            element={<LazyRoute><ProjectProvidersPage /></LazyRoute>}
          />
          <Route
            path={ROUTES.PROJECT_PAYMENTS}
            element={<LazyRoute><ProjectPaymentsPage /></LazyRoute>}
          />
          <Route
            path={ROUTES.PROJECT_EXPENSES}
            element={<LazyRoute><ProjectExpensesPage /></LazyRoute>}
          />
          <Route
            path={ROUTES.PROJECT_TEAM}
            element={<LazyRoute><ProjectTeamPage /></LazyRoute>}
          />
          {/*
            Alta y edición son hijas del listado: el `FormPanel` se monta
            sobre él (ver `Outlet` en la página) en vez de reemplazarlo. Sin
            el loader de página mientras baja el chunk: aparecería abajo del
            listado, no en el panel.
          */}
          <Route
            path={ROUTES.PROJECT_MILESTONES}
            element={<LazyRoute><ProjectMilestonesPage /></LazyRoute>}
          >
            <Route
              path={ROUTES.PROJECT_MILESTONE_NEW}
              element={<Suspense fallback={null}><MilestoneNewPanel /></Suspense>}
            />
            <Route
              path={ROUTES.PROJECT_MILESTONE_EDIT}
              element={<Suspense fallback={null}><MilestoneEditPanel /></Suspense>}
            />
          </Route>
          <Route
            path={ROUTES.PROJECT_DOCUMENTS}
            element={<LazyRoute><ProjectDocumentsPage /></LazyRoute>}
          />
          <Route
            path={ROUTES.PROJECT_BUDGET}
            element={<LazyRoute><ProjectBudgetPage /></LazyRoute>}
          />
          <Route
            path={ROUTES.PROJECT_ADVISOR}
            element={<LazyRoute><ProjectAdvisorPage /></LazyRoute>}
          />
        </Route>

        {/*
          Administración global de la plataforma. Aparte del panel: su propio
          chrome, sin obras ni navegación de obra. Sólo `role: 'admin'`; la API
          lo vuelve a exigir en cada endpoint.
        */}
        <Route element={<AdminLayout />}>
          <Route element={<PlatformLayout />}>
            <Route path={ROUTES.PLATFORM} element={<Navigate to={ROUTES.PLATFORM_USERS} replace />} />
            <Route
              path={ROUTES.PLATFORM_USERS}
              element={<LazyRoute><PlatformUsersPage /></LazyRoute>}
            />
            <Route
              path={ROUTES.PLATFORM_ACTIVITY}
              element={<LazyRoute><PlatformActivityPage /></LazyRoute>}
            />
            <Route
              path={ROUTES.PLATFORM_BILLING}
              element={<LazyRoute><PlatformBillingPage /></LazyRoute>}
            />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={ROUTES.ADMIN} replace />} />
      <Route path={ROUTES.NOT_FOUND} element={<LazyRoute><NotFoundPage /></LazyRoute>} />
    </Routes>
  );
}
