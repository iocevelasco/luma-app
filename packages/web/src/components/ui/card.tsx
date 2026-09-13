import * as React from 'react'

import { cn } from '@/lib/utils'

interface CardProps extends React.ComponentProps<'div'> {
  variant?: 'default' | 'interactive'
}

function Card({ className, variant = 'default', ...props }: CardProps) {
  const interactiveStyles = variant === 'interactive'
    ? 'cursor-pointer transition-all duration-300 relative overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.05),0_2px_4px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.05)] hover:shadow-[0_4px_8px_rgba(0,0,0,0.08),0_8px_16px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.08)] before:absolute before:inset-0 before:rounded-lg before:bg-[linear-gradient(to_bottom_right,rgba(255,255,255,0.05),transparent,rgba(0,0,0,0.05))] before:pointer-events-none before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-300'
    : ''

  return (
    <div
      data-slot="card"
      className={cn(
        'bg-card text-card-foreground flex flex-col gap-4 sm:gap-6 rounded-lg border py-4 sm:py-6 shadow-sm',
        interactiveStyles,
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        '@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-4 sm:px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4 sm:[.border-b]:pb-6  ',
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-title"
      className={cn('leading-none font-semibold font-mono', className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('text-muted-foreground text-sm', className)}
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

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-content"
      className={cn('px-4 sm:px-6', className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center px-4 sm:px-6 [.border-t]:pt-4 sm:[.border-t]:pt-6', className)}
      {...props}
    />
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
}
