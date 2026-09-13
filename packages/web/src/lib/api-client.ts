// API Client con interceptor de sesión.
//
// Ante un 401 con token presente, intenta UNA renovación contra
// `POST /api/auth/refresh` (la cookie `refresh_token`, httpOnly y de 90 días,
// viaja sola) y reintenta la request original. Sólo si esa renovación falla se
// cierra la sesión. Sin esto el access token —7 días, sin renovar— era la vida
// máxima de la sesión: al vencer, el usuario era pateado a /login sin aviso.

import { getApiBaseUrl } from '@luma/shared';
import { ROUTES } from './routes';

interface RequestConfig extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Error de API con el status y el `code` del backend.
 *
 * Extiende Error a propósito: todo el código existente hace
 * `err instanceof Error ? err.message : ...` y sigue funcionando igual, pero
 * ahora además se puede ramificar por `err.code` sin parsear el texto del
 * mensaje — que encima viene sin traducir.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
    // Sin esto `instanceof ApiError` puede dar false según el target de
    // compilación y el bundler.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Rutas donde un 401 NO debe desloguear ni redirigir.
 *
 * Se derivan de ROUTES a propósito: con una lista de literales sueltos, un path
 * mal escrito hace que un 401 borre el token y patee a /login en vez de dejar
 * ver el error de la pantalla pública.
 *
 * Se corta en el primer ':' para que las rutas con parámetro matcheen por prefijo.
 */
const PUBLIC_ROUTE_PREFIXES = [
  ROUTES.LOGIN,
  ROUTES.REGISTER,
  ROUTES.FORGOT_PASSWORD,
  ROUTES.RESET_PASSWORD,
  ROUTES.CHECK_EMAIL,
  ROUTES.VERIFY_EMAIL,
  ROUTES.ACTIVATE,
  ROUTES.CONFIRM_EMAIL_CHANGE,
].map((route) => route.split('/:')[0]);

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/** Qué hacer cuando la sesión ya no se puede recuperar. */
type UnauthorizedHandler = () => void;

/** Qué hacer cuando el access token se renovó por atrás. */
type TokenRefreshedHandler = (token: string) => void;

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const REFRESH_ENDPOINT = '/api/auth/refresh';

class ApiClient {
  /**
   * El AuthProvider los registra al montar. Sin ellos el cliente cae al
   * comportamiento viejo: `window.location.href`, que recarga el documento
   * entero. Con ellos navega por React Router y no se pierde el árbol.
   */
  private unauthorizedHandler: UnauthorizedHandler | null = null;
  private tokenRefreshedHandler: TokenRefreshedHandler | null = null;

  /**
   * Single-flight: si diez queries fallan con 401 a la vez —lo normal al
   * volver a abrir la app— se dispara UN solo refresh y todas esperan el
   * mismo. Diez refresh en paralelo, además de rotar la cookie diez veces,
   * comen el rate limit de /auth/* (10 cada 15 min por IP).
   */
  private refreshPromise: Promise<string | null> | null = null;

  setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
    this.unauthorizedHandler = handler;
  }

  setTokenRefreshedHandler(handler: TokenRefreshedHandler | null): void {
    this.tokenRefreshedHandler = handler;
  }

  private getBaseURL(): string {
    const envUrl = import.meta.env?.VITE_API_BASE_URL as string | undefined;
    // In native apps VITE_API_BASE_URL must be the full absolute URL because
    // the Vite dev proxy is unavailable and relative paths resolve to capacitor://localhost
    if (envUrl) return envUrl;
    return getApiBaseUrl(envUrl);
  }

  private async request<T>(
    endpoint: string,
    config: RequestConfig = {}
  ): Promise<T> {
    const { skipAuth = false, ...fetchConfig } = config;

    const response = await this.performRequest(endpoint, fetchConfig, skipAuth);

    // 401 con token presente: el access token venció (o dejó de valer). Antes
    // de cerrar la sesión, un intento de renovación y un único reintento.
    if (
      response.status === 401 &&
      !skipAuth &&
      endpoint !== REFRESH_ENDPOINT &&
      this.getToken()
    ) {
      const refreshed = await this.refreshSession();

      if (refreshed) {
        const retried = await this.performRequest(endpoint, fetchConfig, skipAuth);
        // Un segundo 401 ya no es un token vencido: no se reintenta de nuevo.
        if (retried.status === 401) {
          return this.failUnauthorized(retried);
        }
        return this.parse<T>(retried);
      }

      return this.failUnauthorized(response);
    }

    if (response.status === 401 && !skipAuth) {
      return this.failUnauthorized(response);
    }

    return this.parse<T>(response);
  }

  private async performRequest(
    endpoint: string,
    fetchConfig: RequestInit,
    skipAuth: boolean
  ): Promise<Response> {
    const baseURL = this.getBaseURL();
    const url = `${baseURL}${endpoint}`;
    const isFormData = fetchConfig.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(fetchConfig.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token && !skipAuth) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      return await fetch(url, {
        ...fetchConfig,
        headers,
        // La cookie `refresh_token` es httpOnly y same-origin en producción,
        // pero en la app nativa la base URL es absoluta y sin esto no viaja.
        credentials: 'include',
      });
    } catch {
      throw new Error('Network error');
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new ApiError(
        body?.error || body?.message || response.statusText || 'Request failed',
        response.status,
        body?.code,
        body?.data,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Cierra la sesión y devuelve el rechazo.
   *
   * `handleUnauthorized()` antes no cortaba el flujo: redirigía Y dejaba que
   * siguiera el `throw` de más abajo, así que el usuario veía el toast de error
   * mientras la pantalla se recargaba. Ahora el error sale con el code
   * `SESSION_EXPIRED` para que la UI pueda distinguirlo y callarlo.
   */
  private async failUnauthorized<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null);
    this.handleUnauthorized();
    throw new ApiError(
      body?.error || body?.message || 'Session expired',
      401,
      body?.code ?? 'SESSION_EXPIRED',
      body?.data,
    );
  }

  /**
   * Renueva el access token contra `/api/auth/refresh`.
   *
   * Devuelve el token nuevo, o null si la cookie ya no sirve. Público porque el
   * AuthProvider también lo usa: su chequeo periódico detecta el vencimiento
   * antes que cualquier request y no tiene por qué desloguear si se puede
   * renovar.
   */
  async refreshSession(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async (): Promise<string | null> => {
      try {
        const response = await fetch(`${this.getBaseURL()}${REFRESH_ENDPOINT}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          credentials: 'include',
        });

        if (!response.ok) return null;

        const body = await response.json().catch(() => null);
        const accessToken = body?.data?.accessToken;
        if (typeof accessToken !== 'string' || !accessToken) return null;

        localStorage.setItem(TOKEN_KEY, accessToken);
        this.tokenRefreshedHandler?.(accessToken);
        return accessToken;
      } catch {
        return null;
      }
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private handleUnauthorized(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);

    // Public routes must never be redirected — they don't need auth
    if (isPublicRoute(window.location.pathname)) return;

    // El AuthProvider navega por React Router y limpia su propio estado. El
    // `location.href` queda sólo como red de contención si nadie se registró.
    if (this.unauthorizedHandler) {
      this.unauthorizedHandler();
      return;
    }
    window.location.href = ROUTES.LOGIN;
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  async patch<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }
}

export const apiClient = new ApiClient();

