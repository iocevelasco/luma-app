'use client'

import * as React from 'react'
import { Tooltip as HeroTooltip } from '@heroui/react'
import { Focusable } from 'react-aria-components/Focusable'

import { cn } from '@/lib/utils'

// ADR-003: Tooltip de HeroUI (React Aria). Cambia respecto de Radix:
//  · `TooltipProvider delayDuration` ya no es global: se guarda en un contexto
//    y cada Tooltip lo usa como `delay`.
//  · `TooltipTrigger asChild` envuelve al hijo con `Focusable`: el hijo debe
//    aceptar `ref` y props del DOM (un `<span>` o nuestros componentes). El
//    `Tooltip.Trigger` de HeroUI no se usa: pinta un `<div role="button">`.
//  · `side` pasa a `placement` y `sideOffset` a `offset`.
const DelayContext = React.createContext(0)

function TooltipProvider({
  delayDuration = 0,
  children,
}: {
  delayDuration?: number
  children?: React.ReactNode
}) {
  return <DelayContext.Provider value={delayDuration}>{children}</DelayContext.Provider>
}

function Tooltip({
  open,
  defaultOpen,
  onOpenChange,
  delayDuration,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  delayDuration?: number
  children?: React.ReactNode
}) {
  const inherited = React.useContext(DelayContext)
  return (
    <HeroTooltip
      isOpen={open}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      delay={delayDuration ?? inherited}
    >
      {children}
    </HeroTooltip>
  )
}

function TooltipTrigger({
  children,
}: {
  asChild?: boolean
  children: React.ReactElement<React.DOMAttributes<Element>>
}) {
  // `Focusable` pide un elemento del DOM; los componentes que reenvían `ref` y props también sirven.
  return <Focusable>{children as unknown as React.ReactElement<React.DOMAttributes<Element>, string>}</Focusable>
}

function TooltipContent({
  className,
  side = 'top',
  sideOffset = 0,
  hidden,
  children,
}: {
  className?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  /** Sin efecto: React Aria centra el tooltip sobre el trigger. */
  align?: 'start' | 'center' | 'end'
  hidden?: boolean
  children?: React.ReactNode
}) {
  if (hidden) return null
  return (
    <HeroTooltip.Content
      data-slot="tooltip-content"
      placement={side}
      offset={sideOffset + 4}
      className={cn('z-50 w-fit text-balance', className)}
    >
      {children}
    </HeroTooltip.Content>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
