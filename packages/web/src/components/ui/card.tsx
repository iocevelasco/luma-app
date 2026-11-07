import * as React from 'react'
import { Card as HeroCard } from '@heroui/react'

import { cn } from '@/lib/utils'

interface CardProps extends React.ComponentProps<'div'> {
  variant?: 'default' | 'interactive'
}

/**
 * `interactive` es una card que se puede tocar entera: sube un pelo y la
 * sombra pasa a la de lo que flota (`shadow-overlay`). Va sobre un `<a>`, un
 * `<button>` o con `role` y `tabIndex` propios; la card no los impone.
 */
function Card({ className, variant = 'default', children, ...props }: CardProps) {
  return (
    <HeroCard
      data-slot="card"
      className={cn(
        'text-surface-foreground gap-4 sm:gap-6 rounded-3xl p-0 py-4 sm:py-6',
        variant === 'interactive' &&
          'cursor-pointer outline-none transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-overlay focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
      {...props}
    >
      {children}
    </HeroCard>
  )
}

/**
 * Acción chica dentro de una card: ícono arriba, rótulo abajo (Silenciar,
 * Llamar, Buscar). Un escalón abajo de la card —`rounded-2xl` dentro de
 * `rounded-3xl`— y un tono bajo ella, para que se lea como una pieza apoyada
 * y no como otra card. Se arma en fila con `grid grid-cols-4 gap-2`.
 */
function CardTile({ className, ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="card-tile"
      className={cn(
        'bg-background text-muted-foreground flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition-colors outline-none',
        'hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        'disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-5 [&>svg]:shrink-0',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Filas agrupadas dentro de una card, con divisor entre una y otra (Mensajes
 * temporales · Desactivado ›). Las filas son `Item`s: el grupo les saca el
 * radio y el borde, y es él quien redondea el conjunto.
 */
function CardList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="list"
      data-slot="card-list"
      className={cn(
        'bg-background divide-border flex flex-col divide-y overflow-hidden rounded-2xl border [&>*]:rounded-none [&>*]:border-transparent',
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <HeroCard.Header
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-4 sm:px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4 sm:[.border-b]:pb-6',
        className,
      )}
      {...props}
    >
      {children}
    </HeroCard.Header>
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('card__title leading-none font-semibold font-mono', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('card__description text-muted-foreground text-sm', className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
        className,
      )}
      {...props}
    />
  )
}

function CardContent({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <HeroCard.Content
      data-slot="card-content"
      className={cn('block flex-none px-4 sm:px-6', className)}
      {...props}
    >
      {children}
    </HeroCard.Content>
  )
}

function CardFooter({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <HeroCard.Footer
      data-slot="card-footer"
      className={cn('px-4 sm:px-6 [.border-t]:pt-4 sm:[.border-t]:pt-6', className)}
      {...props}
    >
      {children}
    </HeroCard.Footer>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardTile,
  CardList,
}
