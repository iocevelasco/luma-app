'use client'

import * as React from 'react'
import { Modal } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003: Dialog sobre el Modal de HeroUI (React Aria). Cambia respecto de Radix:
//  · Sólo se usa controlado (`open` + `onOpenChange`); no hay `DialogTrigger`,
//    `DialogClose`, `DialogPortal` ni `DialogOverlay`: el fondo y el portal van dentro de `DialogContent`.
//  · `modal={false}` (checkout de Stripe) ya no deja interactuar afuera: React Aria
//    siempre es modal. Lo que sí se conserva es que tocar afuera no cierra.
//  · `onCloseAutoFocus`/`onInteractOutside`/`onFocusOutside` no existen. El foco vuelve solo
//    al elemento que abrió el diálogo.
//  · `DialogTitle` es el `Heading` del modal: React Aria lo enlaza como nombre accesible.
type DialogState = { open: boolean; onOpenChange: (open: boolean) => void; modal: boolean }

const DialogContext = React.createContext<DialogState | null>(null)

function useDialogState(): DialogState {
  const state = React.useContext(DialogContext)
  if (!state) throw new Error('DialogContent debe ir dentro de <Dialog>.')
  return state
}

function Dialog({
  open = false,
  onOpenChange,
  modal = true,
  children,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
  children?: React.ReactNode
}) {
  const value = React.useMemo(
    () => ({ open, onOpenChange: onOpenChange ?? (() => {}), modal }),
    [open, onOpenChange, modal],
  )
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & { showCloseButton?: boolean }) {
  const { open, onOpenChange, modal } = useDialogState()
  return (
    <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange} isDismissable={modal}>
      <Modal.Container size="lg" scroll="outside">
        <Modal.Dialog
          data-slot="dialog-content"
          className={cn('gap-4 rounded-3xl p-6', className)}
          {...(props as object)}
        >
          {children}
          {showCloseButton && <Modal.CloseTrigger />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
}

function DialogTitle({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <Modal.Heading
      data-slot="dialog-title"
      className={cn('text-lg leading-none font-semibold font-mono', className)}
    >
      {children}
    </Modal.Heading>
  )
}

function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="dialog-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle }
