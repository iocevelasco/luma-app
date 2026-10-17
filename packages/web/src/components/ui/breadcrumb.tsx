import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { ChevronRight, MoreHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'

function Breadcrumb({ ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />
}

/**
 * `default` es el camino de siempre: eslabones con chevrón. `pill` es la
 * variante contenida —una píldora elevada con el eslabón actual en relieve
 * adentro—, para una navegación de pocos pasos que debe leerse como un control
 * y no como una línea de texto. En `pill` el separador se oculta: el volumen
 * del eslabón actual ya marca dónde estás.
 */
function BreadcrumbList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'ol'> & { variant?: 'default' | 'pill' }) {
  return (
    <ol
      data-slot="breadcrumb-list"
      data-variant={variant}
      className={cn(
        'text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5',
        variant === 'pill' &&
          [
            'bg-card shadow-surface w-fit gap-1 rounded-full border p-1 sm:gap-1',
            '[&_[data-slot=breadcrumb-separator]]:hidden',
            '[&_[data-slot=breadcrumb-link]]:rounded-full [&_[data-slot=breadcrumb-link]]:px-3 [&_[data-slot=breadcrumb-link]]:py-1.5 [&_[data-slot=breadcrumb-link]]:no-underline [&_[data-slot=breadcrumb-link]:hover]:bg-accent',
            '[&_[data-slot=breadcrumb-page]]:bg-secondary [&_[data-slot=breadcrumb-page]]:text-foreground [&_[data-slot=breadcrumb-page]]:rounded-full [&_[data-slot=breadcrumb-page]]:px-3 [&_[data-slot=breadcrumb-page]]:py-1.5 [&_[data-slot=breadcrumb-page]]:shadow-xs',
          ],
        className,
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  )
}

function BreadcrumbLink({
  asChild,
  className,
  ...props
}: React.ComponentProps<'a'> & {
  asChild?: boolean
}) {
  const Comp = asChild ? Slot : 'a'

  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        'text-foreground inline-flex items-center gap-1.5 rounded-xs underline decoration-current/40 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:size-4 [&>svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn(
        'text-muted-foreground inline-flex items-center gap-1.5 font-normal [&>svg]:size-4 [&>svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

function BreadcrumbSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('[&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  )
}

function BreadcrumbEllipsis({
  className,
  ...props
}: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn('flex size-9 items-center justify-center', className)}
      {...props}
    >
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
