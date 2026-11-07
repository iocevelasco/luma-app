'use client'

import * as React from 'react'
import { Popover as HeroPopover } from '@heroui/react'
import { Pressable } from 'react-aria-components/Pressable'

import { cn } from '@/lib/utils'

// ADR-003: Popover de HeroUI (React Aria). Cambia respecto de Radix:
//  · `open` pasa a `isOpen`; `onOpenChange` se mantiene.
//  · `PopoverTrigger asChild` envuelve al hijo con `Pressable`: el hijo debe
//    aceptar `ref` y props del DOM. (`Popover.Trigger` de HeroUI pinta un
//    `<div role="button">` y se descarta.)
//  · `align`/`side` se combinan en `placement` ("bottom start"); `sideOffset` en `offset`.
//  · El contenido es un diálogo: necesita `aria-label` (o un encabezado dentro).
//  · `--radix-popover-trigger-width` pasa a `--trigger-width`.
//  · `PopoverAnchor` no existe en React Aria: no había usos y se quitó.
function Popover({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  return (
    <HeroPopover isOpen={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </HeroPopover>
  )
}

function PopoverTrigger({
  children,
}: {
  asChild?: boolean
  children: React.ReactElement<React.DOMAttributes<Element>>
}) {
  return (
    <Pressable>
      {children as unknown as React.ReactElement<React.DOMAttributes<Element>, string>}
    </Pressable>
  )
}

function PopoverContent({
  className,
  align = 'center',
  side = 'bottom',
  sideOffset = 4,
  'aria-label': ariaLabel,
  role = 'dialog',
  children,
}: {
  className?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  'aria-label'?: string
  /** `presentation` para el popup de un combobox: la lista es el popup, no un segundo diálogo. */
  role?: 'dialog' | 'presentation'
  children?: React.ReactNode
}) {
  const placement = (align === 'center' ? side : `${side} ${align}`) as React.ComponentProps<
    typeof HeroPopover.Content
  >['placement']
  return (
    <HeroPopover.Content
      data-slot="popover-content"
      placement={placement}
      offset={sideOffset}
      className={cn('text-overlay-foreground z-50 w-72 rounded-xl p-4 outline-hidden', className)}
    >
      <HeroPopover.Dialog
        aria-label={ariaLabel}
        {...(role === 'presentation' ? ({ role } as object) : {})}
        className="outline-hidden"
      >
        {children}
      </HeroPopover.Dialog>
    </HeroPopover.Content>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
