'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { CheckIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

// ADR-003, lote C: Radix da el comportamiento (y `id`/`htmlFor`, `<label>` envolvente);
// el aspecto sale de los tokens y utilidades de HeroUI. El Checkbox de React Aria es
// él mismo un <label>, y los call-sites lo anidan en otro: no se puede cambiar sin tocarlos.
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-4 shrink-0 rounded-xs border border-field-border bg-field shadow-field transition-colors outline-none data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-foreground focus-visible:status-focused aria-invalid:status-invalid-field disabled:status-disabled',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
