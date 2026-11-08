import { Spinner as HeroSpinner } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003, lote A. Cambia respecto del Spinner de lucide: ahora es un <span>
// (no un <svg>), toma `currentColor` y el tamaño por `className` (size-4 por defecto).
function Spinner({ className, ...props }: Omit<React.ComponentProps<'span'>, 'color'>) {
  return (
    <HeroSpinner
      role="status"
      aria-label="Loading"
      color="current"
      className={cn('size-4', className)}
      {...props}
    />
  )
}

export { Spinner }
