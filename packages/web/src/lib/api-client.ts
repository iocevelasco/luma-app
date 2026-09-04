import { getApiBaseUrl, type ApiResponse } from '@luma/shared';
import { ROUTES, isPublicRoute } from './routes';

/**
 * Error de API con el status y el `code` del backend.
 *
 * Extiende Error, así que `err instanceof Error ? err.message : …` sigue
 * funcionando en todos lados, pero además se puede ramificar por `code` sin
 * parsear el texto del mensaje.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
  /** Salta el reintento con refresh: lo usa el propio refresh, para no ciclar. */
  skipRefresh?: boolean;
}

const TOKEN_KEY = 'luma_access_token';
const PROJECT_KEY = 'luma_project_id';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const projectStore = {
  get: () => localStorage.getItem(PROJECT_KEY),
  set: (id: string) => localStorage.setItem(PROJECT_KEY, id),
  clear: () => localStorage.removeItem(PROJECT_KEY),
};

class ApiClient {
  /** Una sola renovación en vuelo: si tres queries reciben 401 a la vez, no
   *  se disparan tres refresh que se pisan entre sí. */
  private refreshing: Promise<boolean> | null = null;

  private baseUrl(): string {
    return getApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined);
  }

  private async refreshSession(): Promise<boolean> {
    if (this.refreshing) return this.refreshing;

    this.refreshing = (async () => {
      try {
        const response = await fetch(`${this.baseUrl()}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) return false;
        const body = (await response.json()) as ApiResponse<{ accessToken: string }>;
        if (!body.data?.accessToken) return false;
        tokenStore.set(body.data.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        // Se limpia en el próximo tick para que las llamadas que llegaron
        // mientras tanto compartan el mismo resultado.
        setTimeout(() => {
          this.refreshing = null;
        }, 0);
      }
    })();

    return this.refreshing;
  }

  private onUnauthorized(): void {
    tokenStore.clear();
    projectStore.clear();
    if (!isPublicRoute(window.location.pathname)) {
      window.location.href = ROUTES.LOGIN;
    }
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { skipAuth = false, skipRefresh = false, ...init } = config;

    const isFormData = init.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...((init.headers as Record<string, string>) ?? {}),
    };

    const token = tokenStore.get();
    if (token && !skipAuth) headers.Authorization = `Bearer ${token}`;

    // El proyecto activo viaja en un header y no en cada URL: así ninguna ruta
    // se olvida de scopearse, y el backend lo valida contra la base igual.
    const projectId = projectStore.get();
    if (projectId && !skipAuth) headers['X-Project-Id'] = projectId;

    const response = await fetch(`${this.baseUrl()}${endpoint}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && !skipAuth && !skipRefresh) {
      // Un access token vencido no es motivo para echar a nadie: se renueva
      // con la cookie de refresh y se reintenta una vez.
      const renewed = await this.refreshSession();
      if (renewed) return this.request<T>(endpoint, { ...config, skipRefresh: true });
      this.onUnauthorized();
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(
        body?.error ?? response.statusText ?? 'La petición falló',
        response.status,
        body?.code,
        body?.details,
      );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  /** Desenvuelve `{ success, data }` y lanza si el backend reportó un error. */
  private async unwrap<T>(promise: Promise<ApiResponse<T>>): Promise<T> {
    const body = await promise;
    if (!body.success || body.data === undefined) {
      throw new ApiError(body.error ?? 'Respuesta inesperada del servidor', 500, body.code);
    }
    return body.data;
  }

  get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.unwrap<T>(this.request<ApiResponse<T>>(endpoint, { ...config, method: 'GET' }));
  }

  post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const isFormData = data instanceof FormData;
    return this.unwrap<T>(
      this.request<ApiResponse<T>>(endpoint, {
        ...config,
        method: 'POST',
        body: data === undefined ? undefined : isFormData ? data : JSON.stringify(data),
      }),
    );
  }

  patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.unwrap<T>(
      this.request<ApiResponse<T>>(endpoint, {
        ...config,
        method: 'PATCH',
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
    );
  }

  put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.unwrap<T>(
      this.request<ApiResponse<T>>(endpoint, {
        ...config,
        method: 'PUT',
        body: data === undefined ? undefined : JSON.stringify(data),
      }),
    );
  }

  delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.unwrap<T>(this.request<ApiResponse<T>>(endpoint, { ...config, method: 'DELETE' }));
  }
}

export const apiClient = new ApiClient();
