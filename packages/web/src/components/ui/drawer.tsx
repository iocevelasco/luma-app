'use client'

import * as React from 'react'
import { Drawer as HeroDrawer } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003: Drawer sobre el Drawer de HeroUI (React Aria); reemplaza a vaul. Cambia:
//  · `direction` pasa a `placement` en la Content; la apertura es sólo controlada
//    (`open` + `onOpenChange`). `DrawerTrigger asChild` agrega un `onClick` que abre.
//  · `modal={false}` ya no existe: React Aria siempre es modal. Tocar afuera no cierra.
//  · Desaparecen `snapPoints`, `shouldScaleBackground`, `DrawerPortal`, `DrawerOverlay`.
//  · Se arrastra para cerrar como antes; el asa (`DrawerHandle`) sólo va abajo.
type Placement = 'top' | 'bottom' | 'left' | 'right'
type DrawerState = {
  open: boolean
  onOpenChange: (open: boolean) => void
  placement: Placement
  modal: boolean
}

const DrawerContext = React.createContext<DrawerState | null>(null)

function useDrawerState(): DrawerState {
  const state = React.useContext(DrawerContext)
  if (!state) throw new Error('DrawerContent debe ir dentro de <Drawer>.')
  return state
}

function Drawer({
  open = false,
  onOpenChange,
  direction = 'bottom',
  modal = true,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  direction?: Placement
  modal?: boolean
  children?: React.ReactNode
}) {
  const value = React.useMemo(
    () => ({ open, onOpenChange: onOpenChange ?? (() => {}), placement: direction, modal }),
    [open, onOpenChange, direction, modal],
  )
  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>
}

function DrawerTrigger({
  children,
}: {
  asChild?: boolean
  children: React.ReactElement<{ onClick?: React.MouseEventHandler }>
}) {
  const { onOpenChange } = useDrawerState()
  return React.cloneElement(children, {
    onClick: (event: React.MouseEvent) => {
      children.props.onClick?.(event)
      onOpenChange(true)
    },
  })
}

function DrawerContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'>) {
  const { open, onOpenChange, placement, modal } = useDrawerState()
  return (
    <HeroDrawer.Backdrop isOpen={open} onOpenChange={onOpenChange} isDismissable={modal}>
      <HeroDrawer.Content placement={placement}>
        <HeroDrawer.Dialog
          data-slot="drawer-content"
          className={cn('group/drawer-content gap-0 p-0', className)}
          {...(props as object)}
        >
          {placement === 'bottom' && <HeroDrawer.Handle />}
          {children}
        </HeroDrawer.Dialog>
      </HeroDrawer.Content>
    </HeroDrawer.Backdrop>
  )
}

function DrawerClose({
  asChild,
  children,
  onClick,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const { onOpenChange } = useDrawerState()
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (!event.defaultPrevented) onOpenChange(false)
  }
  if (asChild && React.isValidElement<{ onClick?: React.MouseEventHandler<HTMLButtonElement> }>(children)) {
    return React.cloneElement(children, {
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        children.props.onClick?.(event)
        handleClick(event)
      },
    })
  }
  return (
    <button type="button" data-slot="drawer-close" {...props} onClick={handleClick}>
      {children}
    </button>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        'flex flex-col gap-0.5 p-4 group-data-[placement=bottom]/drawer-content:text-center group-data-[placement=top]/drawer-content:text-center md:gap-1.5 md:text-left',
        className,
      )}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn('mt-auto flex flex-col gap-2 p-4', className)}
      {...props}
    />
  )
}

function DrawerTitle({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <HeroDrawer.Heading
      data-slot="drawer-title"
      className={cn('text-foreground font-semibold font-mono', className)}
    >
      {children}
    </HeroDrawer.Heading>
  )
}

function DrawerDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="drawer-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
