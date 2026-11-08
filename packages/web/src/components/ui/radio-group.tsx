'use client'

import * as React from 'react'
import { Radio, RadioGroup as HeroRadioGroup } from '@heroui/react'

import { cn } from '@/lib/utils'

type RadioGroupProps = Omit<
  React.ComponentProps<typeof HeroRadioGroup>,
  'onChange' | 'isDisabled' | 'className' | 'children'
> & {
  className?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children?: React.ReactNode
}

// ADR-003: RadioGroup de HeroUI (React Aria). `onValueChange` pasa a `onChange`
// y `disabled` a `isDisabled`; `value`/`defaultValue` se mantienen.
function RadioGroup(allProps: RadioGroupProps) {
  const { className, onValueChange, disabled, children, value, ...props } = allProps
  // Controlado si `value` está presente, aunque valga `undefined` (nada elegido todavía).
  const controlled = 'value' in allProps
  return (
    <HeroRadioGroup
      value={controlled ? (value ?? null) : undefined}
      onChange={onValueChange}
      isDisabled={disabled}
      className={cn('grid gap-3', className)}
      {...props}
    >
      {children}
    </HeroRadioGroup>
  )
}

type RadioGroupItemProps = Omit<
  React.ComponentProps<typeof Radio>,
  'isDisabled' | 'className' | 'children'
> & {
  className?: string
  disabled?: boolean
  children?: React.ReactNode
}

// El texto de la opción va como `children`: el área clicable es una sola
// (`Radio.Content`); ya no se envuelve en un `<label>` aparte.
function RadioGroupItem({ className, disabled, children, ...props }: RadioGroupItemProps) {
  return (
    <Radio isDisabled={disabled} className={cn('w-fit', className)} {...props}>
      <Radio.Content>
        <Radio.Control>
          <Radio.Indicator />
        </Radio.Control>
        {children}
      </Radio.Content>
    </Radio>
  )
}

export { RadioGroup, RadioGroupItem }
