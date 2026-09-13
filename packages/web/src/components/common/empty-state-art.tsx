/**
 * Las cuatro ilustraciones de estado vacío, en SVG.
 *
 * Mismo lenguaje que el resto de la marca: línea gris, un solo acento rojo
 * (`--color-primary`) y objetos de gimnasio alrededor del objeto principal.
 *
 * Van en SVG y no en PNG por tres razones: pesan bytes en vez de cientos de
 * kilobytes, se ven nítidas en cualquier densidad de pantalla, y toman el rojo
 * del tema —si mañana cambia el acento de la marca, cambian solas—. Si preferís
 * los PNG originales, alcanza con dejarlos en `public/empty-states/`: el
 * componente los usa y sólo cae a estos dibujos si no están.
 */

const TRAZO = 'stroke-[#8A8A94]';
const RELLENO_CLARO = 'fill-[#E9E9EE]';

interface ArtProps {
  className?: string;
}

/** Listas sin nada cargado: la planilla vacía. */
export function ChecklistArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* Hoja de atrás, para dar volumen a la pila. */}
        <path d="M52 46h96a6 6 0 016 6v72a6 6 0 01-6 6H52a6 6 0 01-6-6V52a6 6 0 016-6z"
          className={`${TRAZO} fill-[#F5F5F8]`} />
        <path d="M44 36h96a6 6 0 016 6v72a6 6 0 01-6 6H44a6 6 0 01-6-6V42a6 6 0 016-6z"
          className={`${TRAZO} fill-white`} />

        {/* La pinza: el único rojo de la pieza principal. */}
        <rect x="76" y="26" width="30" height="16" rx="5"
          className="fill-primary stroke-primary" />

        {/* Renglones vacíos. */}
        <path d="M60 66h64M60 82h64M60 98h44" className={TRAZO} />

        {/* Tres marcas: dos apagadas y una en rojo, el ítem cumplido. */}
        <circle cx="60" cy="66" r="0.5" className={TRAZO} />
        <circle cx="122" cy="112" r="9" className="fill-primary stroke-primary" />
        <path d="M118 112l3 3 5-6" className="stroke-white" strokeWidth="2.5" />
      </g>

      {/* Objetos sueltos: mancuerna, silbato y cronómetro. */}
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 42h8M18 34v16M26 38h10M40 34v16M44 42h8" className={TRAZO} />
        <circle cx="172" cy="42" r="11" className={`${TRAZO} ${RELLENO_CLARO}`} />
        <path d="M172 36v6l4 3" className={TRAZO} />
        <path d="M166 24v-5" className="stroke-primary" />
        <path d="M24 118a10 10 0 1010-10h-14" className={`${TRAZO} ${RELLENO_CLARO}`} />
        <path d="M170 122l8-8M176 128l6-6" className="stroke-primary" />
      </g>
    </svg>
  );
}

/** Plata: la billetera con el visto. */
export function WalletArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M44 56h104a8 8 0 018 8v56a8 8 0 01-8 8H44a8 8 0 01-8-8V64a8 8 0 018-8z"
          className={`${TRAZO} fill-white`} />
        {/* La solapa y el botón. */}
        <path d="M152 82h-22a10 10 0 000 20h22" className={`${TRAZO} ${RELLENO_CLARO}`} />
        <circle cx="136" cy="92" r="3.5" className={TRAZO} />
        <path d="M44 68h96" className={`${TRAZO} opacity-40`} strokeDasharray="4 6" />

        {/* Las pelotas que salen de adentro. */}
        <circle cx="78" cy="48" r="15" className={`${TRAZO} fill-white`} />
        <path d="M78 40l5 4-2 6h-6l-2-6z" className="fill-[#3A3A44] stroke-[#3A3A44]" />
        <circle cx="116" cy="40" r="12" className={`${TRAZO} fill-white`} />
        <path d="M116 34l4 3-1.5 5h-5l-1.5-5z" className="fill-[#3A3A44] stroke-[#3A3A44]" />

        {/* El visto: el acento rojo de la pieza. */}
        <circle cx="52" cy="118" r="20" className="fill-primary stroke-primary" />
        <path d="M43 118l7 7 13-14" className="stroke-white" strokeWidth="4" />
      </g>

      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M150 30l6 6M158 24l4 4" className="stroke-primary" />
        <path d="M28 40l6 6" className={TRAZO} />
        <circle cx="176" cy="126" r="5" className={`${TRAZO} ${RELLENO_CLARO}`} />
      </g>
    </svg>
  );
}

/** Nada que avisar: la campana. */
export function BellArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* Campana de mano, inclinada como si sonara. */}
        <path d="M62 108c-8-16-4-38 12-48s36-4 44 12c4 8 2 14-4 18l-40 24c-6 4-9 2-12-6z"
          className={`${TRAZO} fill-white`} />
        <ellipse cx="74" cy="112" rx="18" ry="10" transform="rotate(-30 74 112)"
          className={`${TRAZO} ${RELLENO_CLARO}`} />
        <circle cx="80" cy="104" r="5" className={`${TRAZO} ${RELLENO_CLARO}`} />
        {/* El mango, en rojo. */}
        <path d="M126 74l24-14" className="stroke-primary" strokeWidth="9" />
        <path d="M150 60l10-6" className={TRAZO} strokeWidth="7" />
      </g>

      {/* Las ondas del sonido: el rayo rojo de la referencia. */}
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M52 52l14 10-8 4 12 8" className="stroke-primary" strokeWidth="5" />
        <path d="M132 96c8 6 10 14 8 22M148 88c10 8 12 20 8 30" className="stroke-primary" />
        <path d="M120 42c8-6 18-6 26 0M132 30c10-6 22-4 30 4" className={TRAZO} />
        <circle cx="36" cy="104" r="5" className="stroke-primary" />
        <path d="M168 128l6-6" className={TRAZO} />
      </g>
    </svg>
  );
}

/** Falla: el 404 partido. */
export function NotFoundArt({ className }: ArtProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true">
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* 4 */}
        <path d="M52 44v34h28M66 44v58" className={`${TRAZO} fill-white`} strokeWidth="9" />
        {/* 4 final */}
        <path d="M120 44v34h28M134 44v58" className={`${TRAZO} fill-white`} strokeWidth="9" />

        {/* El 0, hecho pelota y partido al medio. */}
        <circle cx="100" cy="74" r="26" className={`${TRAZO} fill-white`} />
        <path d="M100 48l8 12-4 14-13 2-7-12z" className="fill-primary stroke-primary" />
        <path d="M88 92l6-8 12 2 4 10" className="fill-primary stroke-primary" />
        {/* La grieta. */}
        <path d="M92 52l6 8-5 7 8 6-4 8" className="stroke-[#3A3A44]" strokeWidth="2.5" />
      </g>

      {/* Valla caída y cono: algo se rompió. */}
      <g strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 118h34M26 104v22M52 104v22" className={TRAZO} />
        <path d="M22 110h34" className="stroke-primary" />
        <path d="M164 126h24l-12-26z" className={`${TRAZO} fill-white`} />
        <path d="M170 114h12" className="stroke-primary" />
        <path d="M44 40l6-8M158 44l8-6" className="stroke-primary" />
      </g>
    </svg>
  );
}
