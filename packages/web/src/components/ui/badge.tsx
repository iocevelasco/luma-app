import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Clock, X, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Tag de estado: una píldora tintada con un círculo de color y el glifo en
 * blanco (ver *Badge* en `DESIGN.md`). El tono dice qué significa:
 *
 * - `neutral` — sin estado: una categoría, un rol, un conteo.
 * - `info` — en camino, informativo.
 * - `success` — hecho, aprobado, cobrado.
 * - `warning` — espera algo o vence pronto.
 * - `danger` — falta o venció: pide acción.
 * - `solid` — el azul macizo: lo que está seleccionado o agregado.
 * - `outline` — sólo filete; para una etiqueta que no es un estado.
 *
 * Los colores salen de los tokens `tag-*` (un juego por tema), nunca de un hex
 * suelto: el texto es un paso más oscuro que el círculo para llegar a AA.
 */
const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border border-transparent px-3 py-1 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none has-[[data-slot=badge-icon]]:pl-1 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        neutral: 'bg-tag-neutral-bg text-tag-neutral-fg [a&]:hover:brightness-95',
        info: 'bg-tag-info-bg text-tag-info-fg [a&]:hover:brightness-95',
        success: 'bg-tag-success-bg text-tag-success-fg [a&]:hover:brightness-95',
        warning: 'bg-tag-warning-bg text-tag-warning-fg [a&]:hover:brightness-95',
        danger: 'bg-tag-danger-bg text-tag-danger-fg [a&]:hover:brightness-95',
        solid: 'bg-tag-solid-bg text-tag-solid-fg [a&]:hover:brightness-110',
        outline:
          'border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
)

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>

/** El círculo: el tono vivo de la paleta. En `solid` es blanco y el glifo, azul. */
const DOT_CLASSES: Partial<Record<BadgeVariant, string>> = {
  neutral: 'bg-tag-neutral-dot text-white',
  info: 'bg-tag-info-dot text-white',
  success: 'bg-tag-success-dot text-white',
  warning: 'bg-tag-warning-dot text-white',
  danger: 'bg-tag-danger-dot text-white',
  solid: 'bg-tag-solid-dot text-tag-solid-bg',
}

/** El glifo por defecto de cada tono con `icon`. Neutral e info piden el suyo. */
const TONE_ICON: Partial<Record<BadgeVariant, LucideIcon>> = {
  success: Check,
  warning: Clock,
  danger: X,
  solid: Check,
}

function Badge({
  className,
  variant,
  icon,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean
    /** `true` = el glifo del tono; o un ícono de Lucide propio. */
    icon?: boolean | LucideIcon
  }) {
  const Comp = asChild ? Slot : 'span'
  const tone: BadgeVariant = variant ?? 'neutral'
  const Icon = icon === true ? TONE_ICON[tone] : icon || undefined
  const dotClass = DOT_CLASSES[tone]

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {Icon && dotClass ? (
        <>
          {/* Decorativo: el estado lo dice el texto, no el color ni el glifo. */}
          <span
            data-slot="badge-icon"
            aria-hidden="true"
            className={cn('flex size-4 shrink-0 items-center justify-center rounded-full', dotClass)}
          >
            <Icon className="size-2.5" strokeWidth={3.5} />
          </span>
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  )
}

export { Badge, badgeVariants }
export type { BadgeVariant }
