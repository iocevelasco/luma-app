'use client'

import * as React from 'react'
import { Drawer as HeroDrawer } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003: Sheet sobre el Drawer de HeroUI (React Aria). Mismos cambios que
// `drawer.tsx`: sólo controlado, `side` es el `placement`, sin Trigger/Close/Portal/Overlay.
type Side = 'top' | 'right' | 'bottom' | 'left'
type SheetState = { open: boolean; onOpenChange: (open: boolean) => void }

const SheetContext = React.createContext<SheetState | null>(null)

function Sheet({
  open = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const value = React.useMemo(
    () => ({ open, onOpenChange: onOpenChange ?? (() => {}) }),
    [open, onOpenChange],
  )
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
}

function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & { side?: Side }) {
  const state = React.useContext(SheetContext)
  if (!state) throw new Error('SheetContent debe ir dentro de <Sheet>.')
  return (
    <HeroDrawer.Backdrop isOpen={state.open} onOpenChange={state.onOpenChange}>
      <HeroDrawer.Content placement={side}>
        <HeroDrawer.Dialog
          data-slot="sheet-content"
          className={cn('gap-4 p-0', className)}
          {...(props as object)}
        >
          {children}
          <HeroDrawer.CloseTrigger />
        </HeroDrawer.Dialog>
      </HeroDrawer.Content>
    </HeroDrawer.Backdrop>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5 p-4', className)} {...props} />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function SheetTitle({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <HeroDrawer.Heading
      data-slot="sheet-title"
      className={cn('text-foreground font-semibold font-mono', className)}
    >
      {children}
    </HeroDrawer.Heading>
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="sheet-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export { Sheet, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
