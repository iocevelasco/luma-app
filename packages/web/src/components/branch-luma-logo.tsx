import type { SVGProps } from 'react';
import {
  LUMA_ISOTYPE_PATH,
  LUMA_LOGO_VIEWBOX,
  LUMA_WORDMARK_PATHS,
} from '@shared/brand/luma-logo';

/** El recuadro del triángulo dentro del lienzo del logo completo (x 122.6–354, y 13.9–120). */
const ISOTYPE_VIEWBOX = '121 12 234.4 109.5';

interface BranchLumaLogoProps extends Omit<SVGProps<SVGSVGElement>, 'fill'> {
  /**
   * Color del logo. Cualquier valor de `fill` de SVG; por defecto hereda el
   * `color` del texto, así `text-foreground` o `text-primary` también andan.
   */
  fill?: string;
  /**
   * Texto accesible. Sin él el logo es decorativo y se oculta a los lectores de
   * pantalla (casi siempre va junto al nombre escrito).
   */
  title?: string;
  /** Sólo el triángulo: para espacios angostos (el header en mobile). */
  isotypeOnly?: boolean;
}

/**
 * Logo de Luma (isotipo y wordmark) en SVG. Los trazos viven en
 * `/shared/brand/luma-logo.ts`, compartidos con la landing: el color se elige
 * por `fill`.
 */
export function BranchLumaLogo({
  fill = 'currentColor',
  title,
  isotypeOnly = false,
  ...props
}: BranchLumaLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={isotypeOnly ? ISOTYPE_VIEWBOX : LUMA_LOGO_VIEWBOX}
      fill={fill}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {!isotypeOnly && (
        <g>
          {LUMA_WORDMARK_PATHS.map((path) => (
            <path key={path} d={path} />
          ))}
        </g>
      )}
      <path d={LUMA_ISOTYPE_PATH} />
    </svg>
  );
}
