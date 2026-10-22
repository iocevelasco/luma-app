/**
 * Clases de los CTA de la landing. Son las variantes `default` y `outline` del
 * Button del panel (`packages/web/src/components/ui/button.tsx`), sin el
 * tamaño: cada lugar pone su `h-*`, `px-*` y `text-*`. La altura va con `h-*` y
 * no con `py-*`: si un día los bordes vuelven a diferir, con padding los dos
 * botones de al lado quedan desparejos.
 *
 * Píldora con relieve. El foco es un anillo verde con 2px de aire: pegado a un
 * relleno verde no se vería. Va con `outline` y no con `ring` porque el ring
 * es box-shadow y pisaría el bisel.
 */
const BASE =
  'cta-label inline-flex items-center justify-center rounded-full transition-all outline-none focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

export const CTA_PRIMARY = `${BASE} border border-primary-pressed bg-primary text-primary-foreground shadow-cta hover:bg-primary-pressed active:shadow-cta-pressed`;

export const CTA_OUTLINE = `${BASE} border border-foreground/45 text-foreground hover:border-foreground/70 hover:bg-secondary/60 active:bg-secondary`;
