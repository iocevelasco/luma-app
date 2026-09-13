import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Canal por el que un estado vacío le avisa al layout que se corra el botón
 * flotante.
 *
 * Existe porque el vacío casi nunca lo decide el layout: la tabla está varios
 * componentes abajo y es ella la que sabe si quedó sin filas, mientras que el
 * layout, desde arriba, sólo ve `children`. Sin esto quedan dos botones
 * diciendo lo mismo: el CTA en el centro de la pantalla vacía y el flotante
 * abajo a la derecha.
 *
 * Se resuelve con un contador y no con un booleano porque una pantalla puede
 * tener más de una tabla, y el primero en desmontarse apagaría la supresión que
 * el otro todavía necesita.
 */
const SupresionContext = createContext<((delta: number) => void) | null>(null);

export function useSupresionDeAccionPrincipal() {
  const [activos, setActivos] = useState(0);
  const reportar = useCallback((delta: number) => {
    setActivos((n) => Math.max(0, n + delta));
  }, []);

  return useMemo(
    () => ({ suprimida: activos > 0, Provider: SupresionContext.Provider, reportar }),
    [activos, reportar],
  );
}

/**
 * Lo llama el estado vacío que YA ofrece la misma acción que el flotante.
 * Mientras está montado, el flotante no se dibuja.
 */
export function useSuprimirAccionPrincipal(activo: boolean) {
  const reportar = useContext(SupresionContext);

  useEffect(() => {
    if (!activo || !reportar) return;
    reportar(1);
    return () => reportar(-1);
  }, [activo, reportar]);
}
