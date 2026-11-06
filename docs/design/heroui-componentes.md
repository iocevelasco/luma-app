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
