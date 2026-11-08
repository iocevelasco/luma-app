'use client'

import * as React from 'react'
import { Avatar as HeroAvatar } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003, lote A. Radix `AvatarFallback` tenía `delayMs`; en HeroUI no existe.
function Avatar({ className, ...props }: React.ComponentProps<typeof HeroAvatar>) {
  return <HeroAvatar data-slot="avatar" className={cn('size-8', className)} {...props} />
}

function AvatarImage({ className, ...props }: React.ComponentProps<typeof HeroAvatar.Image>) {
  return <HeroAvatar.Image data-slot="avatar-image" className={className} {...props} />
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof HeroAvatar.Fallback>) {
  return <HeroAvatar.Fallback data-slot="avatar-fallback" className={cn(className)} {...props} />
}

export { Avatar, AvatarImage, AvatarFallback }
