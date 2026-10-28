/**
 * Las iniciales de una persona para un avatar: "Hernán Duarte" → "HD". Hasta dos
 * letras. Con un nombre vacío da `fallback` (por defecto, nada): un avatar en
 * blanco no dice "no hay nombre".
 */
export function initials(name: string, fallback = ''): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase() || fallback
  );
}
