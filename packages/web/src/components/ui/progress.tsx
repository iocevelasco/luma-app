'use client'

import * as React from 'react'
import { ProgressBar } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003, lote A. `value` sigue siendo 0–100 (Radix: `max` por defecto 100).
// React Aria exige una etiqueta accesible: se completa si el call-site no la trae.
type ProgressProps = Omit<React.ComponentProps<typeof ProgressBar>, 'value' | 'children'> & {
  value?: number | null
}

function Progress({ className, value, ...props }: ProgressProps) {
  return (
    <ProgressBar
      data-slot="progress"
      aria-label="Progress"
      value={Math.min(100, Math.max(0, value ?? 0))}
      className={cn('w-full', className)}
      {...props}
    >
      <ProgressBar.Track>
        <ProgressBar.Fill />
      </ProgressBar.Track>
    </ProgressBar>
  )
}

export { Progress }
