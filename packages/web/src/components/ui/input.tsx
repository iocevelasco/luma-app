import * as React from 'react'
import { Input as HeroInput } from '@heroui/react'

import { fieldFilled, fieldPlaceholder } from '@/lib/field-styles'
import { cn } from '@/lib/utils'

// ADR-003: Input de HeroUI (React Aria). Acepta las props nativas de `<input>`;
// `aria-invalid` cuenta como error por el puente de `heroui.css`.
function Input({ className, type, placeholder, ...props }: React.ComponentProps<'input'>) {
  return (
    <HeroInput
      type={type}
      placeholder={fieldPlaceholder(type, placeholder)}
      data-slot="input"
      fullWidth
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-9 min-w-0 py-1 text-base file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none md:text-sm',
        fieldFilled,
        className,
      )}
      {...props}
    />
  )
}

export { Input }
