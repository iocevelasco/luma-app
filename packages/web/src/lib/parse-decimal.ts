/**
 * Un número tecleado por una persona, con coma o con punto decimal.
 *
 * `Number('2,5')` es `NaN`, y en es-ES, es-AR y pt la coma es el separador
 * decimal. Si hay coma y punto, el último es el decimal y el otro separa miles
 * (`1.234,5`, `1,234.5`); con una sola coma, es el decimal; con varios puntos,
 * son de miles (`1.234.567`). Vacío o inválido da `NaN`: quien llama decide qué
 * hace con un campo vacío. Un número que ya lo es pasa tal cual.
 */
export function parseDecimal(text: string | number | null | undefined): number {
  // React Hook Form también pasa por acá los valores iniciales, que ya son números.
  if (typeof text === 'number') return Number.isFinite(text) ? text : Number.NaN;
  if (typeof text !== 'string') return Number.NaN;

  const compact = text.trim().replace(/\s/g, '');
  if (compact === '') return Number.NaN;

  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  let normalized: string;
  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    normalized = compact.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma !== -1) {
    normalized = compact.replace(',', '.');
  } else {
    const manyDots = (compact.match(/\./g) ?? []).length > 1;
    // Varios puntos sólo valen como miles bien agrupados: `.5.` no es un número.
    normalized = manyDots ? (/^\d{1,3}(\.\d{3})+$/.test(compact) ? compact.split('.').join('') : '') : compact;
  }

  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

/**
 * El `setValueAs` de un campo numérico de React Hook Form: texto con coma o
 * punto, y lo que vale el campo vacío (`undefined` para obligatorio, `0` para
 * opcional).
 */
export function numberField(whenEmpty: number | undefined) {
  return (value: string | number | null | undefined): number | undefined =>
    value === '' || value == null ? whenEmpty : parseDecimal(value);
}
