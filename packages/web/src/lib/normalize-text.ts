/** Sin mayúsculas ni tildes: "fundacion" encuentra "Fundación". Para buscar y comparar texto. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * ¿Un día `YYYY-MM-DD` cae en el rango? Los extremos entran; un extremo vacío
 * es "sin tope". Los días son strings: compararlos como texto es compararlos
 * como fechas, y evita pasar por `Date` (y por Safari).
 */
export function isDayInRange(day: string, from: string, to: string): boolean {
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}
