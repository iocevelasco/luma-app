import type { SVGProps } from 'react';
import {
  LUMA_ISOTYPE_PATH,
  LUMA_LOGO_VIEWBOX,
  LUMA_WORDMARK_PATHS,
} from '@shared/brand/luma-logo';

interface BranchLumaLogoProps extends Omit<SVGProps<SVGSVGElement>, 'fill'> {
  /** Color del logo. Por defecto hereda el `color` del texto. */
  fill?: string;
  /** Texto accesible. Sin él el logo es decorativo y se oculta a los lectores de pantalla. */
  title?: string;
}

/**
 * Logo de Luma (isotipo y wordmark). Los trazos viven en
 * `/shared/brand/luma-logo.ts`, compartidos con la app.
 */
export function BranchLumaLogo({
  fill = 'currentColor',
  title,
  ...props
}: BranchLumaLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={LUMA_LOGO_VIEWBOX}
      fill={fill}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...props}
    >
      <g>
        {LUMA_WORDMARK_PATHS.map((path) => (
          <path key={path} d={path} />
        ))}
      </g>
      <path d={LUMA_ISOTYPE_PATH} />
    </svg>
  );
}
