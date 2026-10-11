import type {
  ApiResponse,
  CreateProjectDocumentInput,
  DeleteProjectDocumentResponse,
  ProjectDocumentListResponse,
  ProjectDocumentResponse,
  UpdateProjectDocumentInput,
} from '@luma/shared';
import { apiClient } from '@/lib/api-client';

/** Capa 1: mismo patrón que `src/api/projects.ts` — nunca lo importa un componente. */

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}

export const documentsApi = {
  list: (projectId: string) =>
    unwrap<ProjectDocumentListResponse>(apiClient.get(`/api/projects/${projectId}/documents`)),

  /**
   * El archivo y su ficha viajan juntos en un solo multipart: dos requests
   * (subir y después describir) dejarían un documento sin título si la segunda
   * falla.
   */
  create: (projectId: string, payload: CreateProjectDocumentInput, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', payload.category);
    formData.append('title', payload.title);
    if (payload.space) formData.append('space', payload.space);
    if (payload.notes) formData.append('notes', payload.notes);

    return unwrap<ProjectDocumentResponse>(
      apiClient.post(`/api/projects/${projectId}/documents`, formData),
    );
  },

  update: (projectId: string, documentId: string, payload: UpdateProjectDocumentInput) =>
    unwrap<ProjectDocumentResponse>(
      apiClient.patch(`/api/projects/${projectId}/documents/${documentId}`, payload),
    ),

  remove: (projectId: string, documentId: string) =>
    unwrap<DeleteProjectDocumentResponse>(
      apiClient.delete(`/api/projects/${projectId}/documents/${documentId}`),
    ),
};
