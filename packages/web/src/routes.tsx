import { Navigate, Route, Routes } from 'react-router-dom';
import { ROUTES } from '@/lib/routes';
import { RequireAuth, RequireClientRole, RequireTeamRole } from '@/components/route-guards';
import { AppShell, ClientShell } from '@/components/layout/app-shell';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { ForgotPasswordPage, SetPasswordPage } from '@/pages/password';
import { DashboardPage } from '@/pages/dashboard';
import { PlanningPage } from '@/pages/planning';
import { MaterialsPage } from '@/pages/materials';
import { PersonnelPage } from '@/pages/personnel';
import { BudgetPage } from '@/pages/budget';
import {
  ContingenciesPage,
  ContingencyDetailPage,
  NewContingencyPage,
} from '@/pages/contingencies';
import { AssistantPage } from '@/pages/assistant';
import { ClientViewPage } from '@/pages/client-view';
import { NewProjectPage, ProjectsPage } from '@/pages/projects';
import { TeamPage } from '@/pages/team';

/**
 * Composición de rutas.
 *
 *   RequireAuth              — sólo decide si hay sesión
 *   └── RequireTeamRole      — separa gestión de cliente
 *       └── AppShell         — chrome y navegación, UNA vez
 *           └── las páginas
 *
 * El shell vive en la capa de layout y no en cada página: así el estado de la
 * navegación y las queries del encabezado no se remontan en cada cambio de
 * ruta.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
      <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
      <Route path={ROUTES.RESET_PASSWORD} element={<SetPasswordPage mode="reset" />} />
      <Route path={ROUTES.ACTIVATE} element={<SetPasswordPage mode="activate" />} />

      <Route element={<RequireAuth />}>
        <Route path={ROUTES.PROJECTS} element={<ProjectsPage />} />
        <Route path={ROUTES.NEW_PROJECT} element={<NewProjectPage />} />

        <Route element={<RequireTeamRole />}>
          <Route element={<AppShell />}>
            <Route path={ROUTES.HOME} element={<DashboardPage />} />
            <Route path={ROUTES.PLANNING} element={<PlanningPage />} />
            <Route path={ROUTES.MATERIALS} element={<MaterialsPage />} />
            <Route path={ROUTES.PERSONNEL} element={<PersonnelPage />} />
            <Route path={ROUTES.BUDGET} element={<BudgetPage />} />
            <Route path={ROUTES.CONTINGENCIES} element={<ContingenciesPage />} />
            <Route path={ROUTES.CONTINGENCY_NEW} element={<NewContingencyPage />} />
            <Route path={ROUTES.CONTINGENCY_DETAIL} element={<ContingencyDetailPage />} />
            <Route path={ROUTES.ASSISTANT} element={<AssistantPage />} />
            <Route path={ROUTES.TEAM} element={<TeamPage />} />
          </Route>
        </Route>

        <Route element={<RequireClientRole />}>
          <Route element={<ClientShell />}>
            <Route path={ROUTES.CLIENT_HOME} element={<ClientViewPage />} />
            <Route path={ROUTES.CLIENT_DECISION} element={<ClientViewPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
}
