import type {
  ApiResponse,
  FeedbackReport,
  FeedbackStatus,
  SubmitFeedbackInput,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1 de la encuesta de feedback: nunca la importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const feedbackApi = {
  status: () => unwrap<FeedbackStatus>(apiClient.get('/api/feedback/status')),
  submit: (input: SubmitFeedbackInput) =>
    unwrap<FeedbackStatus>(apiClient.post('/api/feedback', input)),
  dismiss: () => unwrap<FeedbackStatus>(apiClient.post('/api/feedback/dismiss', {})),
  /** Sólo admin de plataforma. */
  report: () => unwrap<FeedbackReport>(apiClient.get('/api/admin/feedback')),
};
