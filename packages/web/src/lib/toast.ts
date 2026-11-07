import type { ReactNode } from 'react'
import { toast as heroToast } from '@heroui/react'

// ADR-003: los avisos salen del Toast de HeroUI. Se conserva la forma de
// llamada que ya usa toda la app (`toast.success(msg)`, `toast.error(msg)`);
// lo que cambia por dentro: `error` es la variante `danger`, `duration` en ms
// pasa a `timeout` (0 = no se cierra solo) y `action` a `actionProps`.
type ToastOptions = {
  description?: ReactNode
  /** ms; `Infinity` deja el aviso hasta que la persona lo cierre. */
  duration?: number
  action?: { label: ReactNode; onClick: () => void }
}

function toHero(options?: ToastOptions) {
  if (!options) return undefined
  const { description, duration, action } = options
  return {
    description,
    timeout: duration === Infinity ? 0 : duration,
    actionProps: action ? { children: action.label, onPress: action.onClick } : undefined,
  }
}

function toast(message: ReactNode, options?: ToastOptions) {
  return heroToast(message, toHero(options))
}

toast.success = (message: ReactNode, options?: ToastOptions) =>
  heroToast.success(message, toHero(options))
toast.error = (message: ReactNode, options?: ToastOptions) =>
  heroToast.danger(message, toHero(options))
toast.warning = (message: ReactNode, options?: ToastOptions) =>
  heroToast.warning(message, toHero(options))
toast.info = (message: ReactNode, options?: ToastOptions) =>
  heroToast.info(message, toHero(options))

export { toast }
