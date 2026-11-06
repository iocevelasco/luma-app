import { useEffect, useState } from 'react';

/**
 * Por debajo de este ancho la barra de filtros de un listado no entra en una
 * sola línea junto a sus acciones: se esconde detrás de un botón "Filtros".
 * 1280px es `xl`: con el menú lateral, ahí queda lugar justo para la fila entera.
 */
const COMPACT_QUERY = '(max-width: 1279px)';

/**
 * `true` cuando la barra de filtros tiene que ir compacta. Sin `matchMedia`
 * (un entorno raro, o un test) queda en `false`: la barra entera se muestra.
 */
export function useCompactToolbar(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window.matchMedia === 'function' ? window.matchMedia(COMPACT_QUERY).matches : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setCompact(query.matches);
    onChange();
    // `addEventListener` en `MediaQueryList` falta en Safari < 14: `addListener` es el fallback.
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  return compact;
}
