'use client'

import * as React from 'react'
import { Label as HeroLabel } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003: Label de HeroUI (React Aria); sigue siendo un `<label>` con `htmlFor`.
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <HeroLabel
      data-slot="label"
      className={cn(
        'flex items-center gap-2 leading-none select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
