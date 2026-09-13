import { useCallback, useState } from 'react';
import { authApi } from '@/api/auth';
import { ROUTES } from '@/lib/routes';

/**
 * Cierra la sesión a lo bruto y vuelve al login.
 *
 * Es la salida de emergencia de la pantalla de error: cuando la app se rompió,
 * la causa puede ser justamente la sesión —un token viejo, un usuario cacheado
 * con una forma que el código nuevo no entiende— y la
 * persona no tiene cómo salir de ahí. Esto deja el navegador como si nunca
 * hubiera entrado.
 *
 * Por qué no reusa `useLogout`: aquel asume una app viva —muestra un toast,
 * toca los stores y navega con el router— y acá el árbol de React ya está en
 * un estado dudoso. Este camino no depende de nada de eso.
 *
 * Tres cosas que no son obvias:
 *
 * 1. **El refresh token es `httpOnly`** (`auth.controller.ts`), así que
 *    JavaScript NO puede borrarlo. La única forma es que el servidor haga su
 *    `clearCookie`, y por eso se llama al endpoint de logout. Si esa llamada
 *    falla igual seguimos: limpiar lo local es mejor que no limpiar nada, y
 *    un refresh token sin access token no reconstruye la sesión solo.
 *
 * 2. **Se recarga la página en vez de navegar.** Después de un error de render
 *    el árbol quedó desmontado a medias; `navigate()` reusaría ese mismo
 *    contexto roto. Una recarga garantiza arranque limpio.
 *
 * 3. **La URL respeta `BASE_URL`.** En producción la SPA vive bajo `/app`, y
 *    `window.location` no conoce el `basename` del router: un `/login` pelado
 *    caería fuera de la aplicación.
 */
export function useHardSignOut() {
  const [isPending, setIsPending] = useState(false);

  const signOut = useCallback(async () => {
    setIsPending(true);

    // El servidor borra la cookie httpOnly. Best-effort: si la red falla o el
    // token ya venció, seguimos con la limpieza local igual.
    try {
      await authApi.logout();
    } catch {
      // Silencio deliberado: estamos en la pantalla de error, no hay a quién
      // reportarle y el objetivo es salir, no diagnosticar.
    }

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Modo privado de Safari y storage bloqueado por el navegador.
    }

    // Las cookies que sí son legibles desde JS. Se borran en la raíz y en el
    // path de la app: una cookie escrita bajo /app no se borra con path=/.
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0]?.trim();
      if (!name) continue;
      for (const path of ['/', base || '/']) {
        document.cookie = `${name}=; Max-Age=0; path=${path}`;
      }
    }

    window.location.replace(`${base}${ROUTES.LOGIN}`);
  }, []);

  return { signOut, isPending };
}
