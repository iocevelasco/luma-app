'use client'

import * as React from 'react'
import { ListBox, Select as HeroSelect, Separator as HeroSeparator } from '@heroui/react'

import { cn } from '@/lib/utils'

// ADR-003: Select de HeroUI (React Aria). La forma compuesta de siempre
// (Select > SelectTrigger > SelectValue, SelectContent > SelectItem) se conserva;
// lo que cambia por dentro:
//  · `value` vacío ('') es "sin selección" (null en React Aria) y `onValueChange`
//    recibe siempre un string ('' al limpiar).
//  · El item necesita un texto plano para la búsqueda por teclado: si `children`
//    no es un string, pasar `textValue`.
//  · `SelectValue placeholder` se resuelve acá: React Aria lo toma de la raíz.
//  · El trigger lleva `role="combobox"` (patrón select-only combobox), como el de Radix.
type SelectProps = Omit<
  React.ComponentProps<typeof HeroSelect>,
  'value' | 'defaultValue' | 'onChange' | 'isDisabled' | 'children' | 'className' | 'placeholder'
> & {
  className?: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  required?: boolean
  children?: React.ReactNode
}

function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  required,
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <HeroSelect
      data-slot="select"
      value={value === undefined ? undefined : value || null}
      defaultValue={defaultValue || undefined}
      onChange={(key) => onValueChange?.(key == null ? '' : String(key))}
      isDisabled={disabled}
      isRequired={required}
      fullWidth
      className={className}
      {...props}
    >
      {children}
    </HeroSelect>
  )
}

function SelectGroup({ children, ...props }: React.ComponentProps<typeof ListBox.Section>) {
  return (
    <ListBox.Section data-slot="select-group" {...props}>
      {children}
    </ListBox.Section>
  )
}

function SelectValue({
  placeholder,
  className,
  children,
}: {
  placeholder?: React.ReactNode
  className?: string
  /** Contenido propio en vez del item elegido (lo que antes admitía Radix). */
  children?: React.ReactNode
}) {
  return (
    <HeroSelect.Value data-slot="select-value" className={className}>
      {({ isPlaceholder, defaultChildren }) =>
        isPlaceholder ? placeholder : (children ?? defaultChildren)
      }
    </HeroSelect.Value>
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
  ...props
}: Omit<React.ComponentProps<typeof HeroSelect.Trigger>, 'className' | 'children'> & {
  className?: string
  size?: 'sm' | 'default'
  children?: React.ReactNode
  'aria-invalid'?: boolean | 'true' | 'false'
  'aria-label'?: string
}) {
  // El Button de React Aria descarta `role` y `aria-invalid`: se aplican sobre el
  // nodo. `role="combobox"` es el patrón select-only y lo que ya veían los E2E.
  const ref = React.useRef<HTMLButtonElement>(null)
  const autoId = React.useId()
  const triggerId = props.id ?? autoId
  const invalid = ariaInvalid === true || ariaInvalid === 'true'
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    const set = (name: string, value: string | null) => {
      if (value === null) {
        if (node.hasAttribute(name)) node.removeAttribute(name)
      } else if (node.getAttribute(name) !== value) {
        node.setAttribute(name, value)
      }
    }
    const apply = () => {
      set('role', 'combobox')
      // Nombre accesible. React Aria nombra al botón con `aria-labelledby` = valor + el
      // propio botón, así que "Tipo" saldría como "Todos Tipo". Como en Radix, el nombre es
      // el `aria-label` o, si no hay, el de un `<Label htmlFor={id}>` suelto; el valor es contenido.
      const label = node.id
        ? document.querySelector<HTMLElement>(`label[for="${CSS.escape(node.id)}"]`)
        : null
      if (ariaLabel) {
        // Ya se pasa como prop (ver abajo); acá sólo se reafirma si React Aria lo pisa.
        set('aria-labelledby', node.id)
      } else if (label) {
        if (!label.id) label.id = `${node.id}-label`
        set('aria-labelledby', label.id)
      }
      set('aria-invalid', invalid ? 'true' : null)
      set('data-invalid', invalid ? 'true' : null)
    }
    apply()
    // React Aria vuelve a escribir esos atributos cuando registra sus ids: se reaplican.
    const observer = new MutationObserver(apply)
    observer.observe(node, {
      attributes: true,
      attributeFilter: ['role', 'aria-label', 'aria-labelledby', 'aria-invalid', 'data-invalid', 'id'],
    })
    return () => observer.disconnect()
  }, [ariaLabel, invalid])
  return (
    <HeroSelect.Trigger
      ref={ref}
      // Con `aria-label`, el botón se nombra a sí mismo: `aria-labelledby` apuntando a su
      // propio id usa su `aria-label` y no el valor que React Aria agregaría.
      {...(ariaLabel ? { id: triggerId, 'aria-label': ariaLabel, 'aria-labelledby': triggerId } : {})}
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'w-full justify-between gap-2 text-sm whitespace-nowrap data-[size=default]:h-9 data-[size=sm]:h-8',
        className,
      )}
      {...props}
    >
      {children}
      <HeroSelect.Indicator />
    </HeroSelect.Trigger>
  )
}

function SelectContent({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
  /** Sin efecto: antes elegían el posicionamiento de Radix. */
  position?: 'popper' | 'item-aligned'
  align?: 'start' | 'center' | 'end'
}) {
  return (
    <HeroSelect.Popover data-slot="select-content" className={cn('min-w-(--trigger-width)', className)}>
      <ListBox>{children}</ListBox>
    </HeroSelect.Popover>
  )
}

function SelectLabel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <ListBox.Section>
      <span data-slot="select-label" className={cn('text-muted-foreground px-2 py-1.5 text-xs', className)}>
        {children}
      </span>
    </ListBox.Section>
  )
}

function SelectItem({
  className,
  children,
  value,
  textValue,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof ListBox.Item>, 'id' | 'className' | 'children' | 'isDisabled'> & {
  value: string
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <ListBox.Item
      data-slot="select-item"
      id={value}
      textValue={textValue ?? (typeof children === 'string' ? children : value)}
      isDisabled={disabled}
      className={className}
      {...props}
    >
      {children}
      <ListBox.ItemIndicator />
    </ListBox.Item>
  )
}

function SelectSeparator({ className }: { className?: string }) {
  return <HeroSeparator data-slot="select-separator" className={cn('my-1', className)} />
}

// Sin equivalente: la lista de React Aria ya hace scroll sola.
function SelectScrollUpButton() {
  return null
}
function SelectScrollDownButton() {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
