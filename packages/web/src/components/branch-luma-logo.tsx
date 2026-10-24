import type { SVGProps } from 'react';

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
}

/**
 * Logo de Luma (isotipo y wordmark) en SVG. Una sola forma para las dos
 * versiones del archivo original —blanco y negro—: el color se elige por `fill`.
 */
export function BranchLumaLogo({
  fill = 'currentColor',
  title,
  ...props
}: BranchLumaLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 491.73 241.87"
      fill={fill}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      <g>
        <path d="M56.22,159.17v45.85h52.39v21.28H30.05v-67.13h26.17Z" />
        <path d="M184.28,159.17h26.22v36.06c.1,25.37-20.68,32.66-45.85,32.71-25.17-.05-45.95-7.34-45.85-32.71v-36.06h26.17v34.41c-.1,11.04,8.94,12.94,19.68,13.09,10.69-.15,19.78-2.05,19.63-13.09v-34.41Z" />
        <path d="M230.48,159.17h32.76l26.17,33.56,26.22-33.56h32.71v67.13h-26.17v-35.81l-26.22,35.81h-13.09l-26.22-35.81v35.81h-26.17v-67.13Z" />
        <path d="M394.55,159.27h31.12l36.01,67.13h-29.47l-5.29-11.49h-33.61l-5.29,11.49h-29.47l36.01-67.13Zm6.34,39.26h18.43l-9.19-19.83-9.24,19.83Z" />
      </g>
      <path d="M238.29,13.92L122.6,119.97h231.37L238.29,13.92Zm5.61,20.36l36.72,33.66-36.72,33.66V34.28Zm-11.22,67.33l-36.72-33.66,36.72-33.66V101.61Zm56.24-26.06l36.21,33.2h-72.43l36.21-33.2Zm-101.27,0l36.21,33.2h-72.43l36.21-33.2Z" />
    </svg>
  );
}
