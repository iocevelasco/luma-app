import * as React from 'react'

import { fieldBase, fieldFilled } from '@/lib/field-styles'
import { cn } from '@/lib/utils'

function Textarea({ className, placeholder = ' ', ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      placeholder={placeholder}
      className={cn(
        'placeholder:text-muted-foreground flex field-sizing-content min-h-16 w-full text-base md:text-sm',
        fieldBase,
        fieldFilled,
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
