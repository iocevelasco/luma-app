import type { Session } from './session';
import { loginUrl, type WebTarget } from './urls';

export async function loginRequest(
  target: WebTarget,
  clientKey: string,
  email: string,
  password: string,
): Promise<Session> {
  let response: Response;
  try {
    response = await fetch(loginUrl(target), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Luma-Client-Key': clientKey,
      },
      body: JSON.stringify({ email: email.trim(), password }),
    });
  } catch {
    throw new Error('No hay conexión con Luma.');
  }

  const body = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    data?: { accessToken?: string; refreshToken?: string; user?: unknown };
  } | null;

  if (!response.ok || !body?.success) {
    throw new Error(body?.error || 'No pudimos entrar.');
  }
  const data = body.data;
  if (!data?.accessToken || !data?.refreshToken || !data.user) {
    throw new Error('La respuesta de acceso está incompleta.');
  }

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
    sessionStart: Date.now().toString(),
  };
}
