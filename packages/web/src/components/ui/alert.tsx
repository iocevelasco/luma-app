import * as React from 'react'
import { Alert as HeroAlert } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003. El Alert de HeroUI arma indicador + contenido; la app sólo usa título
// y descripción, así que el contenido se arma acá y las llamadas no cambian.
// `variant="destructive"` es `status="danger"` de HeroUI.
function Alert({
  className,
  variant,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & { variant?: 'default' | 'destructive' }) {
  return (
    <HeroAlert
      data-slot="alert"
      role="alert"
      status={variant === 'destructive' ? 'danger' : 'default'}
      className={cn('rounded-lg', className)}
      {...props}
    >
      <HeroAlert.Content>{children}</HeroAlert.Content>
    </HeroAlert>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <HeroAlert.Title
      data-slot="alert-title"
      render={(domProps) => <div {...domProps} />}
      className={cn('tracking-tight', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <HeroAlert.Description
      data-slot="alert-description"
      render={(domProps) => <div {...(domProps as React.ComponentProps<'div'>)} />}
      className={cn('grid justify-items-start gap-1 [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
