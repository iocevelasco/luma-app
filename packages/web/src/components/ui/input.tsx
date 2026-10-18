import * as React from 'react'

import { fieldBase, fieldFilled, fieldPlaceholder } from '@/lib/field-styles'
import { cn } from '@/lib/utils'

function Input({ className, type, placeholder, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      placeholder={fieldPlaceholder(type, placeholder)}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground h-9 w-full min-w-0 rounded-sm border px-3 py-1 text-base file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none md:text-sm',
        fieldBase,
        fieldFilled,
        className,
      )}
      {...props}
    />
  )
}

export { Input }
