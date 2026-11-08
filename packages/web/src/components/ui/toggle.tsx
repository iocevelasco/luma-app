'use client'

import * as React from 'react'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// ADR-003, lote B. Aspecto: `.toggle-button` de HeroUI. El comportamiento sigue
// siendo de Radix a propósito: el editor de markdown envuelve `Toggle` en
// `PopoverTrigger asChild` y le pone `onMouseDown` para no robar el foco, y un
// ToggleButton de React Aria no admite ninguna de las dos cosas. Radix marca el
// estado con `data-state="on"`; `heroui.css` lo trata como `data-selected`.
const toggleVariants = cva(
  "toggle-button toggle-button--ghost rounded-sm hover:text-muted-foreground disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: '',
        outline: 'border border-input shadow-xs',
      },
      size: {
        default: 'toggle-button--md h-9 px-2 min-w-9',
        sm: 'toggle-button--sm h-8 px-1.5 min-w-8',
        lg: 'toggle-button--lg h-10 px-2.5 min-w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
