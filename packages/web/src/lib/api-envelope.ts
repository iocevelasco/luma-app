import type { ApiResponse } from '@luma/shared';

/**
 * Desempaqueta el sobre `{ success, data }` de la API y lanza si no vino el dato.
 *
 * Es lo que hace cada módulo de la capa 1: los módulos nuevos lo importan de
 * acá en vez de copiar su propia versión. Los que ya tenían una local la
 * conservan hasta que se toquen.
 */
export async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.success || response.data === undefined) {
    throw new Error(response.error ?? 'Respuesta inesperada de la API');
  }
  return response.data;
}
