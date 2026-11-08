/**
 * Opciones de `register` para un campo numérico escrito a mano.
 *
 * `valueAsNumber` convierte el campo vacío en `NaN`, y react-hook-form guarda ese `NaN` y lo
 * vuelve a escribir en el input cuando éste se monta de nuevo (reabrir un drawer después de un
 * envío fallido): el campo mostraba "NaN" en lugar de su placeholder. Acá lo vacío o ilegible
 * es `undefined`, que el input dibuja como vacío; el schema pide el campo con `required_error`.
 *
 * Acepta coma o punto como separador decimal.
 */
export const numberField = {
  setValueAs: (value: unknown): number | undefined => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value !== 'string' || value.trim() === '') return undefined;
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : undefined;
  },
} as const;
