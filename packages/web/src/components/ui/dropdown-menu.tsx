'use client'

import * as React from 'react'
import { Dropdown as HeroDropdown, Separator as HeroSeparator } from '@heroui/react'
import { mergeProps } from 'react-aria'
import { Header } from 'react-aria-components/Header'
import { Pressable } from 'react-aria-components/Pressable'

import { cn } from '@/lib/utils'

// ADR-003: Dropdown de HeroUI (React Aria). Cambia respecto de Radix:
//  · `DropdownMenuItem onSelect` pasa a `onAction`; `disabled` a `isDisabled`;
//    `variant="destructive"` a `variant="danger"`. Ya no hay `event.preventDefault()`
//    para dejar el menú abierto.
//  · `asChild` se resuelve con `render`: el hijo (un <Link>, un <a>) se vuelve el
//    ítem y conserva su contenido.
//  · `DropdownMenuTrigger asChild` envuelve al hijo con `Pressable` (debe aceptar
//    `ref` y props del DOM).
//  · Cada ítem necesita un texto plano (`textValue`) para la búsqueda por teclado;
//    se arma solo recorriendo los hijos.
//  · Sin usos y fuera: CheckboxItem, RadioGroup/RadioItem, Sub, Group, Portal.
function textOf(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function DropdownMenu({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
  children?: React.ReactNode
}) {
  return (
    <HeroDropdown isOpen={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      {children}
    </HeroDropdown>
  )
}

function DropdownMenuTrigger({
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

function DropdownMenuContent({
  className,
  align = 'center',
  side = 'bottom',
  sideOffset = 4,
  children,
}: {
  className?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'bottom' | 'left' | 'right'
  sideOffset?: number
  children?: React.ReactNode
}) {
  const placement = (align === 'center' ? side : `${side} ${align}`) as React.ComponentProps<
    typeof HeroDropdown.Popover
  >['placement']
  return (
    <HeroDropdown.Popover
      data-slot="dropdown-menu-content"
      placement={placement}
      offset={sideOffset}
      className={cn('min-w-[8rem]', className)}
    >
      <HeroDropdown.Menu>{children}</HeroDropdown.Menu>
    </HeroDropdown.Popover>
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  asChild,
  onSelect,
  disabled,
  textValue,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof HeroDropdown.Item>,
  'className' | 'children' | 'onAction' | 'isDisabled' | 'variant' | 'textValue'
> & {
  className?: string
  inset?: boolean
  variant?: 'default' | 'destructive'
  asChild?: boolean
  onSelect?: () => void
  disabled?: boolean
  textValue?: string
  children?: React.ReactNode
}) {
  const classes = cn(
    "gap-2 text-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    inset && 'pl-8',
    className,
  )
  const common = {
    'data-slot': 'dropdown-menu-item',
    'data-variant': variant,
    variant: variant === 'destructive' ? ('danger' as const) : ('default' as const),
    isDisabled: disabled,
    onAction: onSelect,
    textValue: textValue ?? textOf(children),
    className: classes,
    ...props,
  }

  if (asChild && React.isValidElement<React.HTMLAttributes<HTMLElement>>(children)) {
    const child = children
    return (
      <HeroDropdown.Item
        {...common}
        render={(domProps: React.HTMLAttributes<HTMLElement>) =>
          React.cloneElement(child, {
            ...mergeProps(domProps, child.props),
            children: child.props.children,
          })
        }
      />
    )
  }

  return <HeroDropdown.Item {...common}>{children}</HeroDropdown.Item>
}

function DropdownMenuLabel({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<'div'> & { inset?: boolean }) {
  return (
    <HeroDropdown.Section>
      <Header
        data-slot="dropdown-menu-label"
        className={cn('px-2 py-1.5 text-sm font-medium', inset && 'pl-8', className)}
        {...props}
      >
        {children}
      </Header>
    </HeroDropdown.Section>
  )
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <HeroSeparator data-slot="dropdown-menu-separator" className={cn('my-1', className)} />
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
}
