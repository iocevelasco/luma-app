'use client'

import * as React from 'react'
import { Checkbox as HeroCheckbox } from '@heroui/react'

import { cn } from '@/lib/utils'

type HeroCheckboxProps = React.ComponentProps<typeof HeroCheckbox>

type CheckboxProps = Omit<
  HeroCheckboxProps,
  'isSelected' | 'defaultSelected' | 'onChange' | 'isDisabled' | 'isIndeterminate' | 'className' | 'children'
> & {
  children?: React.ReactNode
  className?: string
  checked?: boolean | 'indeterminate'
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

// ADR-003: Checkbox de HeroUI (React Aria). Cambia respecto de Radix:
//  · `checked` sigue aceptando `'indeterminate'` (pasa a `isIndeterminate`);
//    `onCheckedChange` recibe sólo `boolean`.
//  · El texto va como `children`: el área clicable es una sola (`Checkbox.Content`).
//    Ya no se envuelve en un `<label>` aparte —sería un label dentro de otro—;
//    para una casilla con `<Label htmlFor>` suelto, el `id` llega al input.
//  · `className` va a la raíz (el contenedor), no al cuadrito.
function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  children,
  ...props
}: CheckboxProps) {
  return (
    <HeroCheckbox
      isSelected={checked === undefined ? undefined : checked === true}
      isIndeterminate={checked === 'indeterminate'}
      defaultSelected={defaultChecked}
      onChange={onCheckedChange}
      isDisabled={disabled}
      className={cn('w-fit', className)}
      {...props}
    >
      <HeroCheckbox.Content>
        <HeroCheckbox.Control>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
        {children}
      </HeroCheckbox.Content>
    </HeroCheckbox>
  )
}

export { Checkbox }
