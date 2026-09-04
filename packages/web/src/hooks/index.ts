import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { currentWeekKey, toDateKey } from '@luma/shared';
import {
  activitiesApi,
  assistantApi,
  budgetApi,
  contingenciesApi,
  dashboardApi,
  materialsApi,
  notificationsApi,
  personnelApi,
  projectsApi,
} from '@/api';
import { queryKeys } from '@/lib/query-keys';
import { useCurrentProjectId } from '@/stores/session-store';

/**
 * Hooks de datos.
 *
 * Cada mutación invalida lo que realmente cambia. No se invalida el proyecto
 * entero por comodidad: marcar una actividad como lista mueve el avance y el
 * dashboard, pero no la lista de trabajadores, y en obra cada refetch de más
 * es un segundo de espera con dos barras de señal.
 */

export function useProjects() {
  return useQuery({ queryKey: queryKeys.projects, queryFn: projectsApi.list });
}

export function useCurrentProject() {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: projectsApi.current,
    enabled: !!projectId,
  });
}

export function useDashboard(week?: string) {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.dashboard(projectId, week),
    queryFn: () => dashboardApi.get(week),
    enabled: !!projectId,
  });
}

export function useClientDashboard() {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.clientDashboard(projectId),
    queryFn: dashboardApi.client,
    enabled: !!projectId,
  });
}

export function useActivities(week?: string) {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.activities(projectId, week),
    queryFn: () => activitiesApi.list(week ? { week } : undefined),
    enabled: !!projectId,
  });
}

export function useUpdateActivityStatus() {
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status: string; blocked_reason?: string }) =>
      activitiesApi.updateStatus(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'activities'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'dashboard'] });
    },
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();
  return useMutation({
    mutationFn: activitiesApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'activities'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'dashboard'] });
    },
  });
}

export function useMaterials(status?: string) {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.materials(projectId, status),
    queryFn: () => materialsApi.list(status),
    enabled: !!projectId,
  });
}

export function useShoppingList() {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.shoppingList(projectId),
    queryFn: materialsApi.shoppingList,
    enabled: !!projectId,
  });
}

export function useCreateMaterial() {
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();
  return useMutation({
    mutationFn: materialsApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'materials'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'dashboard'] });
    },
  });
}

export function useUpdateMaterial() {
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & Record<string, unknown>) =>
      materialsApi.update(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'materials'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'budget'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'dashboard'] });
    },
  });
}

export function useWorkers() {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.workers(projectId),
    queryFn: personnelApi.workers,
    enabled: !!projectId,
  });
}

export function useAttendance(date = toDateKey()) {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.attendance(projectId, date),
    queryFn: () => personnelApi.attendance(date),
    enabled: !!projectId,
  });
}

export function useRecordAttendance() {
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();
  return useMutation({
    mutationFn: personnelApi.recordAttendance,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'dashboard'] });
    },
  });
}

export function useCreateWorker() {
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();
  return useMutation({
    mutationFn: personnelApi.createWorker,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workers(projectId) });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'attendance'] });
    },
  });
}

export function useBudgetStatus() {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.budgetStatus(projectId),
    queryFn: budgetApi.status,
    enabled: !!projectId,
  });
}

export function useCurrentBudget() {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.budgetCurrent(projectId),
    queryFn: budgetApi.current,
    enabled: !!projectId,
  });
}

export function useContingencies(status?: string) {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.contingencies(projectId, status),
    queryFn: () => contingenciesApi.list(status),
    enabled: !!projectId,
  });
}

export function useContingency(id: string) {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.contingency(projectId, id),
    queryFn: () => contingenciesApi.get(id),
    enabled: !!projectId && !!id,
  });
}

/** Invalida todo lo que un imprevisto puede mover: él mismo, plata y cronograma. */
function invalidateContingencyEffects(queryClient: ReturnType<typeof useQueryClient>, projectId: string) {
  void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'contingencies'] });
  void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'contingency'] });
  void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'budget'] });
  void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'dashboard'] });
  void queryClient.invalidateQueries({ queryKey: ['project', projectId, 'activities'] });
  void queryClient.invalidateQueries({ queryKey: queryKeys.clientDashboard(projectId) });
}

export function useCreateContingency() {
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();
  return useMutation({
    mutationFn: ({ submit = true, ...input }: Record<string, unknown> & { submit?: boolean }) =>
      contingenciesApi.create(input, submit),
    onSuccess: () => invalidateContingencyEffects(queryClient, projectId),
  });
}

export function useContingencyAction() {
  const queryClient = useQueryClient();
  const projectId = useCurrentProjectId();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      action: 'approve-internal' | 'send-to-client' | 'submit' | 'decision';
      payload?: Record<string, unknown>;
    }) => {
      switch (params.action) {
        case 'submit':
          return contingenciesApi.submit(params.id);
        case 'approve-internal':
          return contingenciesApi.approveInternal(params.id, params.payload ?? {});
        case 'send-to-client':
          return contingenciesApi.sendToClient(params.id);
        case 'decision':
          return contingenciesApi.clientDecision(
            params.id,
            params.payload as { decision: 'approved' | 'rejected' | 'alternative' },
          );
      }
    },
    onSuccess: () => invalidateContingencyEffects(queryClient, projectId),
  });
}

export function useNotifications() {
  const projectId = useCurrentProjectId();
  return useQuery({
    queryKey: queryKeys.notifications(projectId),
    queryFn: notificationsApi.list,
    enabled: !!projectId,
    refetchInterval: 60_000,
  });
}

export function useAssistantStatus() {
  return useQuery({ queryKey: ['assistant', 'status'], queryFn: assistantApi.status });
}

export function useAskAssistant() {
  return useMutation({
    mutationFn: ({ message, conversationId }: { message: string; conversationId?: string }) =>
      assistantApi.ask(message, conversationId),
  });
}

export function useWeek() {
  return currentWeekKey();
}
