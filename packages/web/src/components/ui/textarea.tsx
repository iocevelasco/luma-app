import * as React from 'react'
import { TextArea as HeroTextArea } from '@heroui/react'

import { fieldFilled } from '@/lib/field-styles'
import { cn } from '@/lib/utils'

// ADR-003: TextArea de HeroUI (React Aria).
function Textarea({ className, placeholder = ' ', ...props }: React.ComponentProps<'textarea'>) {
  return (
    <HeroTextArea
      data-slot="textarea"
      placeholder={placeholder}
      fullWidth
      className={cn(
        'placeholder:text-muted-foreground flex field-sizing-content min-h-16 text-base md:text-sm',
        fieldFilled,
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
