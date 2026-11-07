'use client'

import * as React from 'react'
import { Switch as HeroSwitch } from '@heroui/react'

import { cn } from '@/lib/utils'

type SwitchProps = Omit<
  React.ComponentProps<typeof HeroSwitch>,
  'isSelected' | 'defaultSelected' | 'onChange' | 'isDisabled' | 'className' | 'children'
> & {
  className?: string
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  children?: React.ReactNode
}

// ADR-003: Switch de HeroUI (React Aria). `checked`/`onCheckedChange`/`disabled`
// se traducen a `isSelected`/`onChange`/`isDisabled`. Sin `children` el switch
// queda sin texto y necesita `aria-label`.
function Switch({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  children,
  ...props
}: SwitchProps) {
  return (
    <HeroSwitch
      isSelected={checked}
      defaultSelected={defaultChecked}
      onChange={onCheckedChange}
      isDisabled={disabled}
      className={cn('w-fit', className)}
      {...props}
    >
      <HeroSwitch.Content>
        <HeroSwitch.Control>
          <HeroSwitch.Thumb />
        </HeroSwitch.Control>
        {children}
      </HeroSwitch.Content>
    </HeroSwitch>
  )
}

export { Switch }
