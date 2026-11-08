import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'

import { cn } from '@/lib/utils'

// ADR-003, lote A: el aspecto es `.separator` de HeroUI (`--separator` = `--border`).
// Radix sigue dando `role`/`aria-orientation` y `decorative`.
function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'separator',
        orientation === 'vertical' ? 'separator--vertical h-full' : 'separator--horizontal',
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
