import { useEffect, useRef, useState } from 'react';

const SEARCH_DELAY_MS = 300;

/**
 * El texto de un buscador y su versión asentada. La consulta usa `q`, que
 * espera a que la persona deje de escribir: una consulta por letra es una
 * consulta que nadie va a leer. `onSettled` avisa cuando `q` se actualiza (para
 * volver a la primera página).
 */
export function useDebouncedSearch(onSettled?: () => void) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const settled = useRef(onSettled);

  useEffect(() => {
    settled.current = onSettled;
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(search.trim());
      settled.current?.();
    }, SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  return { search, setSearch, q };
}
