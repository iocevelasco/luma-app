/**
 * Cómo se ve el Markdown de una minuta. **Un solo lugar** para el editor y
 * para la lectura: si cada uno tuviera sus clases, lo que se escribe no se
 * vería igual a lo que después se lee.
 *
 * Los títulos van en Inter y no en serif: `Instrument Serif` es sólo para el
 * título de la pantalla (ver CLAUDE.md). `h1` se pinta como `h2` porque el
 * editor no lo ofrece, pero un Markdown pegado de otro lado lo puede traer.
 */
const BASE = [
  'text-sm leading-relaxed break-words',
  '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
  '[&_p]:my-2',
  '[&_strong]:font-semibold [&_em]:italic',
  '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-0.5 [&_li>p]:my-0',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
];

export const MARKDOWN_PROSE = [
  ...BASE,
  '[&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-medium',
  '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-medium',
  '[&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-medium',
].join(' ');

/**
 * La misma minuta adentro de una card. Los títulos bajan al tamaño del cuerpo:
 * si no, el "Temas tratados" de la minuta queda más grande que el título del
 * hito y la card se lee al revés.
 */
export const MARKDOWN_PROSE_COMPACT = [
  ...BASE,
  '[&_h1]:mt-3 [&_h1]:mb-1 [&_h1]:text-sm [&_h1]:font-semibold',
  '[&_h2]:mt-3 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold',
  '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-medium',
].join(' ');
