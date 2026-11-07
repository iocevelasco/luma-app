# ADR-003: HeroUI v3 como base de componentes — adaptador sobre `components/ui`, tokens de Luma

**Estado:** Propuesto. La fase 1 (tokens y `Button`) está implementada en la rama `feat/spike-heroui-v3`, sin mergear; el resto del reemplazo, componente por componente, está en [`docs/design/heroui-componentes.md`](../design/heroui-componentes.md)
**Fecha:** 2026-11-06
**Decide:** Producto + quien mantiene `packages/web`

## Contexto

Se quiere basar la UI de la app en el **HeroUI Figma Kit** (componentes y layouts).
Antes de decidir se revisó el Figma y se hizo un spike en la rama
`feat/spike-heroui-v3` (página `/spike/heroui`, sólo en desarrollo).

Qué es el Figma, y qué no:

- El primer archivo que se miró es el **kit v2.0.0**. El código estable de HeroUI es
  la **v3** (3.2.7 al 28-oct-2026): una reescritura sobre React Aria Components y
  Tailwind v4, con más de 75 componentes. La portada del kit v2 avisa que v2 quedó
  en mantenimiento. Sus variantes (`solid`, `flat`, `faded`, `shadow`…) no existen
  en v3.
- El referente correcto es el **HeroUI Figma Kit V3** (v3.0.6 en su portada, copia
  de Community; 2026-11-06). Sí coincide con el código: las variantes del Button son
  `primary`, `secondary`, `tertiary`, `outline`, `ghost`, `danger` y `danger-soft`,
  con estados default/hover/focus/disabled y tamaños sm/md/lg. Trae unas 75 páginas
  de componentes (incluye Autocomplete, ComboBox, Breadcrumbs, Pagination, Drawer,
  Toolbar, SearchField, Surface, Table con selección y estados vacíos), una página de
  **Foundations** (colores semánticos claro/oscuro, tipografía Inter, sombras, radios
  de `none` a `4xl` y `full`) y otra de **Templates & Examples**.
- **Layouts: sí hay, pero como ejemplos, no como sistema.** Templates & Examples
  trae unas seis pantallas completas en claro y oscuro: explorador de recursos
  (sidebar + grilla), galería con prompt, editor de tres paneles (capas + lienzo +
  inspector), diálogo de reserva y cliente de correo de tres paneles. Ninguna es un
  panel de gestión de obras: sirven de referencia de composición (sidebar, barra de
  herramientas, panel de detalle), no de arquitectura de la información. Esa sigue
  siendo `docs/design/arquitectura-de-informacion.md`.
- El kit v3 trae un anuncio de **HeroUI Pro** (versión de pago, con dashboards). No
  se evaluó ni se asume.
- La revisión fue sobre capturas de portada, Foundations, Button, Tabs, Table,
  Templates, Modal, AlertDialog, Chip y Toast. No se leyeron las variables de Figma.
  **Select, Drawer e Input no se pudieron ver**: el MCP de Figma alcanzó el límite de
  llamadas del plan Starter de la cuenta que abrió el archivo.

Qué hay hoy en `packages/web`:

| Dato | Valor |
|---|---|
| Archivos en `components/ui` (shadcn) | 59 |
| Archivos que los importan | 121 de 213 `.tsx` |
| Más usados | `button` 77, `label` 39, `input` 33, `badge` 26, `alert-dialog` 20, `select` 18, `card` 16 |
| `asChild` (API de Radix) | 86 usos |
| Estilos con `data-[state=…]` | 48 |
| Paquetes `@radix-ui/*` | 27 |
| E2E | 28 specs; 303 `getByRole('button')`, 71 `dialog`, 63 `option`, 25 `alertdialog` |
| `sidebar`, `calendar`, `pagination`, `carousel`, `chart` | 0 importadores en pantallas |

`DESIGN.md` y `CLAUDE.md` dicen que hay **un solo sistema** (VoltAgent: un verde
`#00d992`, Card `rounded-3xl`, botón `rounded-md`, sin sombras propias). Adoptar
HeroUI tal cual contradice eso; adoptarlo con la identidad de Luma es lo que se probó.

## Qué mostró el spike

Funciona, con Luma como fuente de verdad visual: Button (5 variantes), Input con
`TextField`, Card, Chip, Modal, Select, Tabs (con ícono), Table, Toast, un
formulario con `react-hook-form` + zod, y un header/sidebar oscuros sobre un área
de contenido clara. Typecheck, ESLint y los 436 tests unitarios pasan con el cambio.

Lo que costó, que es lo que define la decisión:

1. **Los nombres de token chocan y significan otra cosa.** En HeroUI `--accent` es
   el color de marca y `--muted` es el color de texto; en Luma `--accent` es el gris
   de hover y `--muted` una superficie. Hay 20 nombres de `@theme` en común y 8
   difieren (`--color-field` y toda la escala `--radius-*`).
   - **Consecuencia directa:** el CSS de HeroUI no se puede cargar globalmente
     (su `variables.css` declara en `:root` y pisaría los tokens de Luma). En el
     spike se re-scopeó a `body.heroui-scope`. Mientras convivan, **una pantalla no
     puede mezclar shadcn y HeroUI**: un `bg-accent` de shadcn vería el verde.
   - Utilidades afectadas hoy (aprox., por regex sobre cadenas de clases):
     `*-accent` 52 usos en 22 archivos, `*-muted` 45 en 31, `*-field` 4 en 4.
2. **La escala de radios de Luma pisa la de HeroUI**: Button y Tabs salen en píldora
   de 28px. Se arregla con un override a `rounded-md`.
3. **`--field`**: el `@theme` de Luma le gana al de HeroUI y el input salía con el
   gris oscuro del chrome sobre superficie clara.
4. **Contraste**: el texto de las variantes "soft" deriva de `#00d992` y no llega a
   AA sobre claro. Se fijó `--accent-soft-foreground: #047857` (4,65:1 sobre `#ececef`).
5. **Chrome oscuro**: el `Button` de v3 hereda `color`. Un subárbol oscuro sin
   `color` propio dejó texto `#18181b` sobre `#242424` (1,14:1). Además los
   tokens derivados (`--*-hover`, `--*-soft`) son `color-mix()` que se resuelven donde
   se declaran: el bloque entero se copia para el subárbol oscuro.
6. **Portales**: un Select dentro del header oscuro abre su lista con los tokens
   claros del `<body>`. Es el límite que ya tiene `.surface-dark` con shadcn.
7. **`null` de HeroUI**: un Select sin elegir devuelve `null`; zod lo trata como tipo
   inválido. Cada formulario migrado tiene que contemplarlo.
8. **Infra**: `tailwind-merge` 2.5.5 → 3.7.0 (lo exige HeroUI; el spike lo cambia para
   toda la app). El resolver de CSS de Vite no entiende el `exports` de
   `@heroui/styles`, así que el spike importa por ruta relativa a `node_modules`
   (frágil; falta ver el build de Docker).

**Peso** (build con el spike contra uno sin él, JS + CSS gzip): 1173 → 1338 KB,
**+165 KB**. Son ~125 KB de JS y ~38 KB de CSS, en un chunk aparte; el bundle
principal casi no se mueve. El CSS incluye **todos** los componentes (se importó
`components/index.css` entero). **No se midió cuánto se recupera** al quitar Radix.

**Lo que el spike no probó:** Safari/iOS, E2E, Drawer, Tooltip, Dropdown, Popover,
Autocomplete/ComboBox, pantallas reales de Luma, mezcla shadcn + HeroUI en una
pantalla, y la API de eventos de React Aria (`onPress` frente a `onClick`) sobre
los 77 usos de `button`.

## Qué muestra el kit v3 de los componentes que Luma usa

Se revisaron los que más pesan en pantallas (Chip, Modal, AlertDialog, Toast; Button,
Tabs y Table, arriba). Lo que cambia o abre una decisión:

1. **Chip y los tags de Luma casi coinciden, pero falta el tono `info`.** El Chip
   tiene variantes `primary`, `secondary`, `tertiary` y `soft`; tipos `accent`,
   `default`, `success`, `warning` y `danger`; tamaños `lg`, `md` y `sm`; y ranuras de
   prefijo y sufijo. Los ejemplos del kit usan `soft` con un punto de color adelante
   ("• Completed"), que es casi el tag de `DESIGN.md` (píldora tintada con círculo
   de color). Pero **no hay tipo `info`**, y los tags de Luma tienen `info` (azul) y
   `solid` (azul macizo). Con el acento de Luma en verde, el tipo `accent` no los
   reemplaza: hace falta un token o una variante propia para ese tono.
2. **AlertDialog es un componente aparte de Modal**, con encabezado de ícono (a la
   izquierda o centrado), pie horizontal o vertical y tamaños `xs`–`lg` más uno
   móvil (viewports hasta 599 px). El Modal suma `cover` y `full`, y un pie con
   casilla opcional ("no volver a mostrar"). Coincide con la regla de Luma de
   `AlertDialog` para lo destructivo. En móvil el kit apila los botones en vertical.
3. **El móvil es un tamaño del mismo diálogo, no un cambio a Drawer.** El
   `ResponsiveDialog` de Luma (9 usos) intercambia Dialog y Drawer. Si se conserva o
   se reemplaza por el tamaño móvil del kit queda sin decidir: el Drawer no se pudo ver.
4. **Toast**: cinco tipos (`default`, `accent`, `success`, `warning`, `danger`),
   con ícono, título, descripción, botón de acción y cierre opcionales. La regla de
   Luma usa sólo éxito y fallo sin formulario, "verde y nada más": la acción y la
   descripción quedarían sin uso.
5. **Table**: variantes `primary` y `secondary`, selección, estados vacíos (búsqueda,
   filtro y error) y un ejemplo con barra de herramientas y paginación. Cubre más
   de lo que Luma tiene hoy; no se evaluó contra `RowCard`, que es la regla de listas
   de `arquitectura-de-informacion.md`.
6. **Los nombres de variante del kit sí coinciden con el código** (`variant` y, en
   el Figma, `type` ≈ `color` en el código). El spike usó `Chip color="success"
   variant="soft"` y compiló sin cambios.

## Decisión

Se propone **adoptar HeroUI v3 como motor de componentes y mantener la identidad
visual de Luma**, migrando detrás de los archivos que ya existen.

1. **v3, no v2.** El kit de referencia es el **HeroUI Figma Kit V3**; el kit v2 no
   es la referencia del código ni de las variantes. Del kit v3 están revisados
   Foundations, Button, Tabs, Table, Modal, AlertDialog, Chip y Toast; faltan Select,
   Drawer e Input (ver Contexto).
2. **Adaptador**: `@/components/ui/*` conserva sus nombres y exports y se
   reimplementa sobre HeroUI, un componente por vez. Los 121 archivos que los usan
   no cambian, salvo lo que la fase 1 demuestre que no se puede preservar
   (`asChild` y las props de eventos).
3. **Una definición por nombre de token.** El CSS de HeroUI vive en `node_modules` y
   no se edita, así que el que se renombra es el lado de Luma. La fase 1 resuelve
   `accent`, `muted` y `field` (≈100 usos) y la escala de radios antes de portar
   ningún componente. Con eso desaparece el scope `body.heroui-scope` y el
   chrome oscuro pasa a ser una clase de tokens, no un parche.
4. **`DESIGN.md`, `CLAUDE.md` y `post-edit-check.sh` se reescriben en el mismo PR
   que la fase 1**: la regla "`components/ui/` no se edita" cambia (ahora son los
   adaptadores), y las reglas de radio y de colores crudos hay que reapuntarlas a los
   tokens nuevos. Una regla que sólo vive en prosa se afloja (CLAUDE.md, "Cómo está
   configurado Claude acá").
5. **Cada fase se mergea sola**, con E2E en Chromium (no se instala WebKit), versión
   de web subida (`pnpm bump:web minor`) y sin errores de consola.
6. **Se corta si**, en la fase 1: (a) Button o Dialog no se pueden adaptar sin tocar
   más de un tercio de sus importadores; (b) el neto de bundle, ya sin los paquetes de
   Radix reemplazados, sigue por encima de +100 KB gzip; o (c) los overlays de React
   Aria fallan en Safari/iOS (se mira a mano en el simulador o un iPhone; los E2E
   corren sólo en Chromium).

### Fases

El detalle por componente (pantallas que lo usan, equivalente de HeroUI, riesgo) está
en [`docs/design/heroui-componentes.md`](../design/heroui-componentes.md).

| Fase | Qué | Para avanzar |
|---|---|---|
| 0 | Decidir este ADR. Borrar los 29 archivos de `components/ui` sin ningún importador | Decisión de Producto; `grep` y build en verde |
| 1 | **Hecha en la rama.** Tokens (`accent` y `muted` → `secondary`, 122 usos en 48 archivos), puente `styles/heroui.css`, `Button` sobre HeroUI, `tailwind-merge` 3, reglas y docs | Criterio de corte (a): cumplido para `Button`; falta `Dialog` (fase 3). Ver Resultado de la fase 1 |
| 2 | **Parcial:** Label, Input, Textarea y trigger de Select, hechos con estilos de HeroUI (ver doc). Falta el comportamiento de Select, Checkbox, RadioGroup y Switch. Campos, **juntos** porque comparten `field-styles`: `Label`, `Input`, `Textarea`, `Select` (con adaptador de `Controller`), `Checkbox`, `RadioGroup`, `Switch` | E2E de los flujos con formularios |
| 3 | Overlays: `AlertDialog`, `Dialog`, `ResponsiveDialog`, `Sheet`/`Drawer`, `Popover`, `DropdownMenu`, `Tooltip` | E2E de diálogos; Safari/iOS a mano |
| 4 | `Tabs`, `Badge` → `Chip`, `Card`, `Toast` (en lugar de `sonner`), `Table`, `Command`, `Breadcrumb` y los de sólo aspecto | Decisiones abiertas de abajo |
| 5 | Quitar `@radix-ui/*`, `vaul`, `cmdk` y `sonner`; medir el bundle final | Revisión en Safari/iOS |

### Resultado de la fase 1

- **Tokens**: HeroUI define los suyos a partir de los de Luma (`color-mix` incluido) en
  `:root`, `.surface-light` y `.surface-dark`; no hay un solo hex duplicado. El
  scope `body.heroui-scope` del spike desaparece.
- **`Button`**: HeroUI sobre un `<button>` nativo (no el componente de React Aria): la API
  no cambia, así que **cero call-sites tocados** de los 77 que lo usan, y el criterio
  de corte (a) de arriba no se dispara. `asChild` sigue por `Slot`.
- **Lo que el Button cambia a la vista**: sin relieve (`shadow-cta`), con el hover y el
  presionado de HeroUI. Se mantuvieron dos reglas de `DESIGN.md` con overrides en el
  puente: el `outline` sin borde y el `secondary` con texto neutro.
- **Lo que quedó sin tocar a propósito**: `Input`, `Textarea` y `SelectTrigger` (fase 2,
  juntos), y las sombras `shadow-cta*` (definidas, sin uso).
- **El CSS crece de a una pieza**: hoy sólo se importa `button.css`.

## Opciones consideradas

### A — Adaptador sobre HeroUI v3, identidad de Luma (propuesta)

Cambia el motor sin tocar los 121 archivos que importan `components/ui`. Se paga con
un renombre de tokens mecánico y con el trabajo de cada adaptador: son 59 archivos,
pero sólo unos 28 componentes tienen usos reales en pantallas.

### B — Migración directa a la API de HeroUI en cada pantalla

Compound components por todos lados (`Modal.Backdrop > Modal.Container > …`). Es la
forma "idiomática", pero obliga a tocar 121 archivos a la vez y hace imposible un PR
revisable. Se descarta; el adaptador no impide llegar ahí después, pantalla a pantalla.

### C — Mantener shadcn y tomar sólo la anatomía del kit

El camino de menor riesgo: sin dependencia nueva, sin choque de tokens. No da
accesibilidad de React Aria ni componentes que faltan (Autocomplete, Table con
ordenamiento, Toast apilado). Es la alternativa si la fase 1 dispara un criterio de corte.

### D — HeroUI v2

Es lo que muestra el Figma. Se descarta por estar en mantenimiento y por ser otra
pila; no se probó en este spike.

### E — Dos sistemas conviviendo por pantalla

No es viable sin renombrar los tokens (punto 1 del spike). Sólo sirve como puente
dentro de una misma fase.

## Trade-offs

| | A (propuesta) | C (sólo anatomía) |
|---|---|---|
| Superficie que cambia | 59 adaptadores + tokens | Ajustes puntuales |
| Riesgo de regresión visual | Alto en fases 1 y 3 | Bajo |
| Accesibilidad / componentes nuevos | React Aria, Table, Autocomplete, Toast | Los de Radix de hoy |
| Bundle | +165 KB medido; recuperación sin medir | Sin cambio |
| Reversible | Por fase, hasta la 5 | Sí |
| Costo de mantener | Seguir las rupturas de v3 (3.0.5 y 3.2.0 ya tuvieron) | Seguir shadcn |

## Consecuencias

- Deja de valer "un solo sistema = shadcn con tokens VoltAgent": pasa a ser HeroUI
  con tokens VoltAgent. `DESIGN.md` sigue mandando sobre el aspecto.
- `components/ui/` deja de ser "no se edita": son los adaptadores y se editan.
- Las rupturas de HeroUI llegan por `pnpm update`: hay que fijar la versión y leer su
  changelog (v3.2.0 cambió Radio/Checkbox/Switch a `*.Content`; 3.0.5 renombró `Text`).
- El spike toca `package.json`, `pnpm-lock.yaml` y `routes.tsx`; **no se mergea**.
  Si se decide seguir, la fase 1 es un PR nuevo desde `main`.

## Acciones

- [x] Conseguir y revisar el kit v3 de Figma (variantes y anatomía coinciden con el
      código; ver Contexto).
- [x] Revisar en el kit v3 Modal, AlertDialog, Chip y Toast.
- [ ] Revisar en el kit v3 **Select, Drawer e Input** (quedaron fuera por el límite de
      llamadas del MCP de Figma en el plan Starter; hay que esperar el reinicio de la
      cuota o abrir las páginas a mano en Figma).
- [ ] Decidir el tono `info` de los tags: HeroUI no tiene tipo `info`, y el acento de
      Luma es verde. Hace falta un token propio o una variante, antes de la fase 2.
- [ ] Decidir si `ResponsiveDialog` sigue cambiando a Drawer en móvil o pasa al
      tamaño móvil del diálogo del kit.
- [ ] Decidir qué hace Luma con las Tabs del kit: la `primary` es una píldora y la
      `secondary` un subrayado; las de Luma son `rounded-md` con ícono (`DESIGN.md`).
- [ ] Decidir este ADR (A, C u otra) y, si es A, nombrar quién hace la fase 1.
- [ ] Medir en la fase 1: `onPress` frente a `onClick`, `asChild`, build de Docker con
      los imports de `@heroui/styles`, y el bundle sin Radix.
- [ ] Reescribir `DESIGN.md`, `CLAUDE.md` y `post-edit-check.sh` junto con la fase 1.
- [ ] Probar los overlays en un iPhone real o en el simulador antes de la fase 3.

## Actualización — migración de los componentes de interacción

Los 28 componentes pedidos pasaron a HeroUI salvo `badge`, `command`, `toggle` y
`toggle-group` (motivos en `docs/design/heroui-componentes.md`). Se quitaron `sonner` y
`vaul` de `packages/web`; siguen `cmdk` (command) y `@radix-ui/*` de los componentes que no
migraron. El detalle de props y call-sites tocados está en esa tabla.
