import { cn } from '@/lib/utils'

// ADR-003, lote A: `.skeleton` de HeroUI con su animación de pulso.
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('skeleton skeleton--pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
