'use client'

import * as React from 'react'
import { AlertDialog as HeroAlertDialog } from '@heroui/react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ADR-003: AlertDialog de HeroUI (React Aria). Cambia respecto de Radix:
//  · Sólo controlado (`open` + `onOpenChange`); sin `AlertDialogTrigger`/`Portal`/`Overlay`.
//  · `AlertDialogAction` y `AlertDialogCancel` siguen cerrando al hacer clic, salvo que
//    el `onClick` llame a `event.preventDefault()`.
//  · No hay `onCloseAutoFocus`: el foco vuelve solo a quien abrió el diálogo.
//  · Escape y tocar afuera cierran, igual que con Radix (se reactivan: HeroUI los apaga).
type AlertDialogState = { open: boolean; onOpenChange: (open: boolean) => void }

const AlertDialogContext = React.createContext<AlertDialogState | null>(null)

function useAlertDialogState(): AlertDialogState {
  const state = React.useContext(AlertDialogContext)
  if (!state) throw new Error('AlertDialogContent debe ir dentro de <AlertDialog>.')
  return state
}

function AlertDialog({
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
  return <AlertDialogContext.Provider value={value}>{children}</AlertDialogContext.Provider>
}

function AlertDialogContent({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'>) {
  const { open, onOpenChange } = useAlertDialogState()
  return (
    // Escape y el clic afuera cierran, como con Radix: HeroUI los apaga por defecto en un
    // AlertDialog, y una confirmación de la que no se puede salir con el teclado es una trampa.
    <HeroAlertDialog.Backdrop
      isOpen={open}
      onOpenChange={onOpenChange}
      isDismissable
      isKeyboardDismissDisabled={false}
    >
      <HeroAlertDialog.Container size="md">
        <HeroAlertDialog.Dialog
          data-slot="alert-dialog-content"
          className={cn('gap-4 rounded-3xl p-6', className)}
          {...(props as object)}
        >
          {children}
        </HeroAlertDialog.Dialog>
      </HeroAlertDialog.Container>
    </HeroAlertDialog.Backdrop>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function AlertDialogTitle({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <HeroAlertDialog.Heading
      data-slot="alert-dialog-title"
      className={cn('text-lg font-semibold font-mono', className)}
    >
      {children}
    </HeroAlertDialog.Heading>
  )
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="alert-dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function useCloseOnClick(onClick?: React.MouseEventHandler<HTMLButtonElement>) {
  const { onOpenChange } = useAlertDialogState()
  return (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event)
    if (!event.defaultPrevented) onOpenChange(false)
  }
}

function AlertDialogAction({
  className,
  onClick,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(buttonVariants(), className)}
      onClick={useCloseOnClick(onClick)}
      {...props}
    />
  )
}

function AlertDialogCancel({
  className,
  onClick,
  ...props
}: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: 'outline' }), className)}
      onClick={useCloseOnClick(onClick)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
}
