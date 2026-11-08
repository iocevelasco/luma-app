# Reemplazo de componentes por HeroUI v3

Propuesta de qué componente de `components/ui` pasa a HeroUI v3, en qué orden y con
qué riesgo. Es el detalle de [ADR-003](../adr/003-heroui-v3.md): el ADR decide,
esto lista. Los números son de `packages/web/src` el 2026-11-06 (`pantallas` =
archivos fuera de `components/ui` que lo importan).

## Cómo se reemplaza

Dos mecanismos, según si el componente tiene comportamiento:

| Mecanismo | Cuándo | Qué cambia en los call-sites |
|---|---|---|
| **Estilos de HeroUI sobre un elemento nativo** (`buttonVariants()` + clases `.button--*`) | El componente es sólo aspecto: Button, Badge, Card, Separator, Skeleton… | Nada. Se conserva `asChild`, `onClick`, `disabled`. |
| **Componente de HeroUI (React Aria)** detrás del mismo archivo de `components/ui` | Hay comportamiento: Select, Modal, Tabs, Toast, Tooltip… | Lo que no se pueda esconder: eventos (`onPress`), `value`/`onValueChange` → `selectedKey`/`onSelectionChange`, `asChild`. |

En los dos casos el archivo de `components/ui` conserva su nombre y sus exports, y los
tokens de Luma siguen siendo la fuente de verdad: HeroUI los lee vía
`styles/heroui.css`. Cada componente que se migra suma su CSS a ese archivo
(`@import …/components/<nombre>.css`), así que el CSS de HeroUI crece de a una pieza.

## Hecho (fase 1)

| Qué | Cómo |
|---|---|
| Tokens | `--accent` y `--muted` dejan de ser el gris de hover/superficie de shadcn: en HeroUI son la marca y el texto secundario. El gris se llama `secondary` (mismo valor). 122 usos renombrados en 48 archivos (`bg-accent`, `bg-muted`, `text-accent-foreground`…), sin cambio visual. HeroUI define sus tokens **a partir de** los de Luma (`styles/heroui.css`), en `:root`, `.surface-light` y `.surface-dark`. |
| `Button` | Variantes de HeroUI sobre un `<button>` nativo. Nombres de siempre (`default`, `destructive`, `outline`, `secondary`, `ghost`, `link`) más los de HeroUI (`primary`, `tertiary`, `danger`, `danger-soft`). `asChild` por `Slot`. `buttonVariants()` se conserva (lo usan `alert-dialog`, `calendar`, `pagination` y 8 pantallas). Radio `rounded-md`. |

Cambia el aspecto del Button: sin la sombra de relieve (`shadow-cta`) y con el hover y el
presionado de HeroUI (`color-mix` sobre el token). Hay que reflejarlo en `DESIGN.md`.

## Fase 2 — campos de formulario (parcial)

**Hecho:** `Label`, `Input`, `Textarea` y el trigger de `Select` (más `provider-combobox` y
`option-picker`, que comparten `fieldBase`) usan `.input` / `.textarea` / `.label` de HeroUI
sobre un elemento nativo. `fieldBase` pasó a ser `input input--primary`; el estado "completo"
(`fieldFilled`) se conservó. `aria-invalid` cuenta como error (puente en `heroui.css`).
Cero call-sites tocados. **Falta:** el comportamiento de `Select` (lista), `Checkbox`,
`RadioGroup` y `Switch` siguen en Radix; pasarlos a React Aria cambia `onCheckedChange` →
`onChange` y `value` → `selectedKey`, y toca 29 call-sites.


Input, Textarea y `SelectTrigger` comparten `lib/field-styles.ts` ("un campo que cambia
distinto a su vecino se lee como un bug"): se migran en el mismo PR.

| Hoy | Pantallas | HeroUI | Notas y riesgo |
|---|---|---|---|
| `label` | 39 | `Label` | Hoy es Radix. Medio. |
| `input` | 33 | `Input` (estilos) | Los seis estados de `field-styles` (foco, "completo", error…) hay que decidir si se conservan o se cambian por los de HeroUI. |
| `textarea` | 12 | `TextArea` (estilos) | Idem. |
| `select` | 18 | `Select` + `ListBox` | **El de más riesgo de la fase.** API distinta (`onSelectionChange`, `null` si no hay selección: zod lo rechaza como tipo inválido) y 24 archivos usan `react-hook-form`. Hace falta un adaptador de `Controller`. |
| `checkbox` | 8 | `Checkbox` | Desde HeroUI 3.2.0 va en `Checkbox.Content`. |
| `radio-group` | 2 | `RadioGroup` | Idem. |
| `switch` | 1 | `Switch` | Idem. |

**Lote A (hecho):** `separator`, `skeleton`, `spinner`, `progress` y `avatar` sobre HeroUI.
`separator` y `skeleton` con sus clases; `spinner`, `progress` y `avatar` con el componente.
Cambios de API: `Spinner` pasa de `<svg>` a `<span>` (toma `currentColor`; el tamaño, por
`className`); `Progress` exige etiqueta accesible (`aria-label="Progress"` por defecto) y
acota `value` a 0–100; `AvatarFallback` pierde `delayMs`.

**Lote B (hecho):** `tabs` sobre el componente `Tabs` de HeroUI (adaptador: `value` →
`selectedKey`, `onValueChange` → `onSelectionChange`, `TabsTrigger value` → `Tab id`; el
deslizamiento lo hace `Tabs.Indicator`). `table` y `breadcrumb` con las clases de HeroUI sobre
el HTML semántico (el `Table` de React Aria no tiene `colSpan`, `tfoot` ni `caption`; el
`Breadcrumbs`, ni `asChild` ni `pill`). `toggle` y `toggle-group` con `.toggle-button` pero
**con Radix**: el editor de markdown los usa dentro de `PopoverTrigger asChild` y con
`onMouseDown`, que un `ToggleButton` de React Aria no admite.
Cambio en E2E: las aserciones de pestaña activa pasan de `data-state="active"` a
`aria-selected="true"` (`platform-activity`, `platform-users`).

**Lote C (parcial):** `checkbox`, `switch` y `radio-group` con los tokens y utilidades de HeroUI
(`bg-accent`, `bg-field`, `status-focused`…), **sin cambiar de librería**: el `Checkbox` de
React Aria es un `<label>` y los call-sites lo anidan en otro `<label>` o lo enlazan con
`id`/`htmlFor`. Pasarlos exige tocar esos 11 usos. `select` (la lista) sigue en Radix.

## Fase 3 — superficies y avisos que se abren

| Hoy | Pantallas | HeroUI | Notas y riesgo |
|---|---|---|---|
| `alert-dialog` | 20 | `AlertDialog` | Componente aparte en el kit. Pie vertical en móvil. |
| `dialog` | 11 | `Modal` | Tamaños `xs`–`lg`, `cover`, `full`. |
| `responsive-dialog` | 9 | `Modal` (tamaño móvil) o `Drawer` | **Decisión abierta** (ADR-003): hoy cambia a Drawer con `vaul` en móvil. |
| `sheet` + `drawer` | 3 + 3 | `Drawer` | Se juntan en uno. |
| `popover` | 6 | `Popover` | |
| `dropdown-menu` | 6 | `Dropdown` + `Menu` | `asChild` en el disparador. |
| `tooltip` | 9 | `Tooltip` | Retraso por defecto de 1500 ms en HeroUI (`--tooltip-delay`). |

Portales: un overlay que sale de una zona oscura (`.surface-dark`) abre con los tokens
del `<body>`. `DashboardLayout` ya pone `surface-light` en el `<body>` por el mismo
motivo, así que no cambia nada.

## Fase 4 — navegación, datos y avisos

| Hoy | Pantallas | HeroUI | Notas y riesgo |
|---|---|---|---|
| `tabs` | 10 | `Tabs` | La `primary` es una píldora y la `secondary` un subrayado; las de Luma son `rounded-md` con ícono. Hay que decidir. |
| `badge` | 26 | `Chip` (`soft` + punto) | **No hay tipo `info`**: hace falta un token o variante para el azul de los tags y el `solid`. |
| `card` | 16 | `Card` | Luma usa `rounded-3xl`. |
| `toast` + `sonner` | 2 + 30 archivos | `Toast` | Luma sólo usa éxito y fallo sin formulario: la acción y la descripción quedan sin uso. |
| `table` | 1 | `Table` | Trae selección y estados vacíos. No se evaluó contra `RowCard`. |
| `command` | 2 | `ComboBox` o `Autocomplete` | Reemplaza `cmdk`. |
| `breadcrumb` | 1 | `Breadcrumbs` | |
| `separator`, `skeleton`, `spinner`, `avatar`, `progress`, `alert` | 5, 4, 4, 4, 3, 2 | `Separator`, `Skeleton`, `Spinner`, `Avatar`, `ProgressBar`, `Alert` | Sólo aspecto; bajo riesgo. |
| `toggle` + `toggle-group` | 2 + 1 | `ToggleButton` + `ToggleButtonGroup` | |

## Sin equivalente o sin uso

| Qué | Pantallas | Propuesta |
|---|---|---|
| `scroll-area` | 2 | Se queda en Radix (o `overflow` nativo). `ScrollShadow` de HeroUI es una sombra, no un contenedor. |
| 29 archivos sin ningún importador: `accordion`, `aspect-ratio`, `button-group`, `calendar`, `carousel`, `chart`, `collapsible`, `context-menu`, `empty`, `field`, `floating-action-button`, `form`, `hover-card`, `input-group`, `input-otp`, `item`, `kbd`, `menubar`, `navigation-menu`, `pagination`, `resizable`, `sidebar`, `slider`, `toaster` (+ `use-mobile` y `use-toast` con 3 y 1) | 0 | **Borrar antes de migrar**: reducen el trabajo a unos 30 componentes y quitan paquetes de Radix. Verificar con `grep` y con el build, y que nadie los tenga en una rama abierta. |

## Lo que sigue sin resolver

- **Tono `info` del Badge** (HeroUI no lo tiene).
- **`ResponsiveDialog`**: Drawer o tamaño móvil.
- **Tabs**: píldora, subrayado o las de Luma.
- **Select, Drawer e Input del kit de Figma** no se pudieron revisar (límite del MCP).
- **Estados de los campos** de `field-styles`: conservar o adoptar los de HeroUI.
- **Safari/iOS** sin probar en ninguno de los componentes.

## Cómo se verifica cada fase

`pnpm typecheck`, `pnpm lint`, `pnpm test` y la suite E2E de Chromium; `pnpm bump:web
minor`; sin errores de consola; y una captura por pantalla modificada con la cuenta fija
del rol que la ve (CLAUDE.md, "Code review de un PR").

## Apéndice — props y atributos que cambian al pasar de Radix a React Aria (HeroUI)

Para los componentes que **todavía no** se migraron. Sale de las APIs de ambos lados, **no
verificado contra cada call-site**: antes de migrar uno, buscar sus usos con `grep`.

**Reglas generales**

| Radix / shadcn | React Aria / HeroUI |
|---|---|
| `onClick` | `onPress` (el evento no es el del DOM: sin `stopPropagation()` directo) |
| `disabled` | `isDisabled` (también `isInvalid`, `isRequired`, `isReadOnly`) |
| `open` / `defaultOpen` | `isOpen` / `defaultOpen` (`onOpenChange` igual) |
| `asChild` | no existe: el disparador es un hijo directo o se usa `render` |
| `data-[state=open\|closed\|checked\|on]` (48 usos en el repo) | `data-[open]`, `data-[selected]`, `data-[pressed]`, `data-[disabled]` |
| `side`, `align`, `sideOffset` | `placement`, `offset` |
| `value` / `onValueChange(string)` | `selectedKey` / `onSelectionChange(Key \| null)`; en HeroUI v3 `value` / `onChange` |
| `aria-invalid` | `isInvalid` (el puente de `heroui.css` cubre `.input` y `.textarea`) |

**Por componente**

| Componente | Cambios |
|---|---|
| `checkbox` | `checked` → `isSelected`; `onCheckedChange(bool)` → `onChange(bool)`; `checked="indeterminate"` → `isIndeterminate`; el rótulo va dentro de `Checkbox.Content` (3.2.0) |
| `switch` | `checked`/`onCheckedChange` → `isSelected`/`onChange`; el `Thumb` va dentro de `Switch.Control` |
| `radio-group` | `onValueChange` → `onChange`; `RadioGroupItem value` → `Radio value` con `Radio.Content`; `orientation` igual |
| `select` | `SelectItem value` → `ListBox.Item id` (+ `textValue`); `SelectContent` → `Select.Popover` + `ListBox`; `placeholder` pasa a la raíz; sin selección el valor es `null`; `SelectGroup`/`SelectLabel` → `ListBox.Section` |
| `tabs` | `TabsTrigger value` / `TabsContent value` → `Tabs.Tab id` / `Tabs.Panel id`; `TabsList` va dentro de `Tabs.ListContainer`; sin `forceMount` |
| `toggle`, `toggle-group` | `pressed`/`onPressedChange` → `isSelected`/`onChange`; `type="single\|multiple"` → `selectionMode`; `value` (array) → `selectedKeys` (`Set`) |
| `tooltip` | `TooltipProvider delayDuration` → `delay` por tooltip (HeroUI trae 1500 ms: `--tooltip-delay`); `side` → `placement` |
| `popover` | `PopoverTrigger asChild` → `Popover.Trigger`; `PopoverAnchor` no existe |
| `dropdown-menu` | `DropdownMenuItem onSelect` → `Menu.Item onAction`; ítems de checkbox y radio → `selectionMode`; `DropdownMenuSub` distinto |
| `command` | cmdk → `ComboBox` / `Autocomplete`: el filtrado es propio y `onSelect` → `onSelectionChange` |
| `dialog`, `alert-dialog` | `DialogContent` → `Modal.Backdrop` > `Modal.Container` > `Modal.Dialog`; `onInteractOutside`/`onEscapeKeyDown` → `isDismissable`/`isKeyboardDismissDisabled`; `DialogTitle` → `Modal.Heading`; `AlertDialogAction`/`Cancel` → `Button slot="close"` |
| `responsive-dialog` | hoy cambia a Drawer con `vaul` en móvil: decisión abierta (ADR-003) |
| `sheet`, `drawer` | `side` / `direction` → `placement`; `vaul` (`snapPoints`, `shouldScaleBackground`) sin equivalente |
| `toast`, `sonner` | `toast.error` → `toast.danger`; `duration` → `timeout`; `Toaster` → `Toast.Provider`; `description`/`action` de sonner → opciones de `toast()` de HeroUI |
| `table` | `<table>` HTML → `Table.Content` con `Column`, `Row`, `Cell` por `id` y `isRowHeader`; sin `TableCaption` |
| `breadcrumb` | `BreadcrumbList`/`Item`/`Link asChild` → `Breadcrumbs` > `Breadcrumbs.Item href`; el separador es automático |
| `badge` | `variant` (`default`, `secondary`, `destructive`, `outline`) y los tags de Luma → `Chip variant` + `color`; sin tipo `info` |
| `card`, `alert` | Luma tiene su propia anatomía (`CardTile`, `CardList`, `interactive`; `Alert` con ícono en grilla): HeroUI usa `Card.Header`/`Content` y `Alert.Indicator`; migrarlos exige reescribir los call-sites o conservar el layout actual |

## Lotes D, E y F — checkbox, switch, radio, select, overlays, toast, card, alert

Estos componentes **ya usan los componentes de HeroUI** (React Aria) detrás de la misma
ruta `@/components/ui/*`. Lo que cambia en cada API y en los call-sites:

| Componente | Detrás | Cambia en la API | Call-sites tocados |
|---|---|---|---|
| `checkbox` | `Checkbox` (Field + Content + Control) | `checked` admite `'indeterminate'`; `onCheckedChange` recibe `boolean`; **el texto va como `children`** (el área clicable es una); `className` va a la raíz | 7 que envolvían la casilla en `<label>` pasan a `<Checkbox>texto</Checkbox>`; los de `id` + `<Label htmlFor>` quedan |
| `tri-state-checkbox` | el `Checkbox` | ya no necesita lógica propia: dibuja guion en `indeterminate` | E2E: `data-state="indeterminate"` → `toBeChecked({ indeterminate: true })` |
| `switch` | `Switch` | `checked/onCheckedChange/disabled` → `isSelected/onChange/isDisabled` | ninguno (usan `aria-label`) |
| `radio-group` | `RadioGroup` + `Radio` | `onValueChange` → `onChange`; el texto va como `children` de `RadioGroupItem` | 2 que usaban `<label>` |
| `select` | `Select` + `ListBox` | `value` vacío = sin selección (null); `SelectItem` necesita `textValue` si el hijo no es texto; `SelectValue placeholder` se resuelve en el adaptador; el trigger recibe `role="combobox"`, `aria-invalid` y el nombre de su `<Label htmlFor>` por efecto (el Button de React Aria los descarta) | ninguno |
| `tooltip` | `Tooltip` | `delayDuration` del Provider va por contexto; `TooltipTrigger asChild` envuelve con `Focusable` (el hijo debe aceptar `ref`); `side` → `placement` | `nav-rail-item` (texto sobre fondo claro), `kbd` |
| `popover` | `Popover` + `Dialog` | `open` → `isOpen`; el contenido es un diálogo y pide `aria-label`; `role="presentation"` para popups de combobox; `--radix-popover-trigger-width` → `--trigger-width`; `PopoverAnchor` fuera (sin usos) | 6, por `aria-label` y el ancho |
| `dropdown-menu` | `Dropdown` | `onSelect` → `onAction`; `disabled` → `isDisabled`; `variant="destructive"` → `danger`; `asChild` se resuelve con `render` (RAC avisa en consola de desarrollo que el elemento es un `<a>`, no un `<div>`) | ninguno |
| `dialog`, `alert-dialog` | `Modal`, `AlertDialog` | sólo controlados (`open` + `onOpenChange`); sin `Trigger/Close/Portal/Overlay`; `Action`/`Cancel` cierran salvo `preventDefault`; Escape y clic afuera no cierran un AlertDialog | `onCloseAutoFocus` (2, en `project-materials`) pasa a enfocar el panel al cerrar; `delete-project-dialog` (`asChild` en la descripción) |
| `sheet`, `drawer` | `Drawer` | `side`/`direction` → `placement`; reemplaza a **vaul** (se quitó la dependencia); `DrawerTrigger asChild` agrega un `onClick` | ninguno |
| `responsive-dialog` | los dos anteriores | `modal={false}` (checkout de Stripe) ya no deja interactuar afuera: sólo evita que tocar afuera cierre | — |
| `form-panel` | primitivas de React Aria (`ModalOverlay`/`Modal`/`Dialog`) | un panel que tapa sólo el área de contenido no existe en HeroUI | — |
| `toast` / `sonner` | `Toast` de HeroUI | nuevo `@/lib/toast` con la forma de siempre (`toast.error` = `danger`, `duration` → `timeout`, `action` → `actionProps`); `Toaster` pasa a `toast-region.tsx`; se quitó **sonner** | 29 imports, 2 tests, 1 selector de E2E (`.toast--danger`) |
| `card` | `Card` | `CardHeader/Content/Footer` son las partes de HeroUI con el layout de Luma; título y descripción siguen siendo `div` | — |
| `alert` | `Alert` | `variant="destructive"` → `status="danger"`; el contenido se arma dentro del adaptador | — |

**Siguen sin HeroUI:** `badge` (círculo con glifo, tono `info` y `asChild` que `Chip` no tiene,
y DESIGN.md lo define así) y `command` (cmdk; HeroUI no tiene Command). `toggle` y
`toggle-group` conservan Radix por `asChild`/`onMouseDown` del editor de markdown.

**Riesgos sin verificar a mano:** el checkout de Stripe dentro de `ResponsiveDialog modal={false}`
(captcha y 3D Secure); el tooltip por hover con puntero real; Safari/iOS (React Aria y los
overlays no se probaron ahí); contraste de los diálogos en superficies oscuras.
