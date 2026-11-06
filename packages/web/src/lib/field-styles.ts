/**
 * Los estados de un campo de texto, en un solo lugar (ADR-003, fase 2: el aspecto
 * sale de `.input` de HeroUI —reposo, hover, foco, error y deshabilitado— sobre
 * los tokens de Luma; `heroui.css` hace que `aria-invalid` cuente como error).
 * Lo que sigue es el contrato original, de referencia:
 *
 * Los seis estados de un campo de texto, en un solo lugar. Input, Textarea y
 * SelectTrigger los comparten: un campo que cambia distinto a su vecino se lee
 * como un bug, no como un detalle.
 *
 *   reposo      borde `input`, relleno `field` (token propio, ver index.css)
 *   hover       el borde se oscurece (se aclara sobre el tema oscuro)
 *   foco        borde y anillo verdes — el foco se ve, siempre
 *   completo    borde de tinta: el campo tiene algo escrito. Input y Textarea
 *               ponen un placeholder de un espacio cuando no llevan uno: sin
 *               placeholder CSS no puede distinguir vacío de lleno
 *   error       borde y anillo rojos, fijos: no esperan al foco
 *   deshabilitado  relleno `field-disabled`, sin borde de énfasis
 *
 * `not-aria-invalid` y `not-focus-visible` evitan que hover o "completo" pisen
 * al error y al foco: tienen más especificidad que `aria-invalid:` y `focus-visible:`.
 */
export const fieldBase = 'input input--primary'

/**
 * "Completo": sólo Input y Textarea (`:placeholder-shown`). Exige el atributo
 * `placeholder`, que el componente completa; un `type="date"` no lo lleva y
 * queda sin este estado.
 */
export const fieldFilled =
  'enabled:[&[placeholder]:not(:placeholder-shown):not([aria-invalid=true]):not(:focus-visible)]:border-foreground/90'

/** Tipos de input con `:placeholder-shown`: los únicos donde sirve el placeholder de un espacio. */
const PLACEHOLDER_TYPES = new Set(['text', 'email', 'password', 'search', 'tel', 'url', 'number'])

/** El placeholder que lleva un campo: el suyo, o un espacio para que exista `:placeholder-shown`. */
export function fieldPlaceholder(type: string | undefined, placeholder: string | undefined) {
  if (placeholder !== undefined) return placeholder
  return type === undefined || PLACEHOLDER_TYPES.has(type) ? ' ' : undefined
}
