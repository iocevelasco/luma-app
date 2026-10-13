# Sistema de diseño de Luma

Fuente de verdad única. Lo implementan `packages/web/src/index.css` y
`packages/landing/src/index.css`, con **los mismos valores y los mismos nombres
de token**; si algo de acá y algo del CSS no coinciden, manda el CSS del panel y
este archivo está mal.

El sistema es **VoltAgent**: un lienzo casi negro, un único verde eléctrico como
marca, tarjetas de relieve suave y una grilla que se lee como documentación
vestida de producto. El análisis completo de la referencia está en
[`voltagent/DESIGN.md`](voltagent/DESIGN.md); lo de abajo es lo que Luma adopta
y cómo lo nombra.

> **Historial.** Hubo un sistema anterior —naranja `#fa520f`, superficies crema,
> temas claro y oscuro— que ya no existe. Si ves `bg-cream`, `brand-fill`,
> `sunshine-*` o `beige` en un archivo, es resto de esa etapa.

## La voz

Técnica, sobria, nocturna. Un solo tema, **oscuro**: no hay modo claro ni
switch, y la landing y el panel comparten fondo y marca para que pasar de
`/home` a `/app` no se sienta como cambiar de producto.

El verde aparece poco y cuando aparece significa "acá se actúa" (CTA, estado
activo, foco). No es un color decorativo.

## Color

Un solo tema. Los valores viven en `:root` del panel y en `@theme` de la landing.

### Marca

| Token | Hex | Para qué |
|---|---|---|
| `brand` / `primary` | `#00d992` | Marca, relleno de CTA, foco, estado activo |
| `primary-foreground` | `#101010` | Texto sobre el relleno verde — **10.3:1** |
| `primary-pressed` | `#10b981` | Hover y estado presionado |
| `primary-soft` | `#2fd6a1` | Variantes ghost y focus rings sutiles |

A diferencia del naranja anterior, **el verde no necesita partirse en dos
tokens**: texto `#101010` sobre `#00d992` pasa AA con holgura en cualquier
tamaño. `brand` y `primary` siguen siendo dos nombres por **rol** (tinta/ícono vs.
relleno de CTA), no porque el hex cambie. `bg-primary text-primary-foreground`
es siempre correcto.

### Superficies

| Token | Hex | Uso |
|---|---|---|
| `background` | `#101010` | Lienzo — el único fondo de página |
| `card` / `popover` / `sidebar` | `#1a1a1a` | Una card se despega del fondo por **color**, no sólo por filete |
| `secondary` / `muted` / `accent` | `#242424` | Chips, hover de menú, un escalón **arriba** de la card |

El escalón de `secondary` no es capricho: un badge o un hover viven casi siempre
encima de una card. Si compartieran hex con la superficie que los contiene,
desaparecerían.

### Tinta y filetes

| Token | Hex | Uso |
|---|---|---|
| `foreground` | `#f2f2f2` | Texto principal (~17:1 sobre el lienzo) |
| `muted-foreground` | `#bdbdbd` | Cuerpo y texto secundario (~10:1) |
| `border` | `#3d3a39` | Filete universal de 1px |
| `border-strong` | `#57534e` | Filete de énfasis, divisores de FAQ |

### Estados

Información, no decoración: independientes del verde de marca.

| Token | Hex |
|---|---|
| `destructive` / `status-danger` | `#e8455a` |
| `success` / `status-active` | `#3dbd69` |
| `warning` / `status-warning` | `#e0a63a` |
| `info` / `status-info` | `#7dd3fc` |
| `status-neutral` | `#8b949e` |

El rojo significa **peligro**, nunca marca.

## Tipografía

**Inter** para todo lo narrativo y de interfaz. **JetBrains Mono** (con
`SF Mono` primero) para lo que se podría escribir en una terminal: código,
contadores, numeración.

**Instrument Serif** es el único serif y tiene un uso acotado:

| Dónde | Qué lleva serif |
|---|---|
| Panel | Sólo el título de cada pantalla (`PageHeader`, `font-serif`) |
| Landing | `h1` y `h2` — el display. De `h3` para abajo es Inter |

El serif ya se aplica en la capa base de la landing; no hace falta repetirlo en
el JSX. Peso 400, sin negrita: el display de este sistema no es bold.

Piso de tamaño: **11px**, escrito en `rem` (`text-2xs`). Un `text-[10px]` en px no
responde al tamaño de texto del sistema operativo, justo en los rótulos que más
lo necesitan.

Las fuentes de la landing son **self-hosted** (subset latino, woff2) y salen del
bundle con hash. No se piden a Google Fonts: una hoja externa bloquea el render.

## Radio

Controles en la escala chica, superficies en la grande.

| Clase | Valor | Se usa en |
|---|---|---|
| `rounded-xs` | 4px | Chips micro, indicadores |
| `rounded-sm` | 6px | **Input**, Select, Textarea, ítems de menú |
| `rounded-md` | 8px | **Botones**, code blocks, filas internas |
| `rounded-lg` | 14px | Dialog, menú, dropdown, toast |
| `rounded-xl` | 18px | Popover grande, alert dialog |
| `rounded-2xl` | 22px | Panel destacado |
| `rounded-3xl` | **28px** | **Card** — el radio dominante |
| `rounded-full` | píldora | **Sólo** estados: Badge, Avatar, Switch, Slider, Progress |

Dos reglas:

1. **No hay botones píldora.** La píldora significa "esto es un estado", no
   "esto se toca".
2. **El hijo va un escalón abajo del padre.** Un input `rounded-sm` dentro de una
   card `rounded-3xl`. Un radio interno mayor que el del contenedor deja una luz
   visible en la esquina.

Nunca un radio arbitrario: `rounded-[14px]` no existe.

## Espaciado

Base 4px, incremento principal 8px. Usá la escalera numérica de Tailwind
(`p-4` = 16px), no tokens propios: declarar `--spacing-md` pisa las tallas
t-shirt y `max-w-md` deja de ser 28rem.

Sí hay tokens de sección porque no caen en la escalera: `section` 64px,
`section-lg` 96px y `hero` 120px en el panel; en la landing, `section` 96px y
`section-sm` 64px.

## Profundidad

La card se despega del lienzo por **color** (`#1a1a1a` sobre `#101010`) y además
lleva una sombra suave de apoyo.

| Rol | Valor | Uso |
|---|---|---|
| plano | borde 1px `border`, sin sombra | Filas, divisores, inputs |
| `shadow-surface` | `0 1px 2px rgb(0 0 0 / .3), 0 8px 24px -12px rgb(0 0 0 / .5)` | Card en reposo |
| `shadow-overlay` | `0 20px 60px rgb(0 0 0 / .7)` + filete interno | Dialog, menú, popover |

Nada de `shadow-glow`: un resplandor de marca no es profundidad.

## Componentes

**Botón primario** — `bg-primary text-primary-foreground`, `rounded-md`, hover
`primary-pressed`. Altura `h-9`, o `h-10` en `lg`.

**Botón secundario / outline** — borde `border`, texto `foreground`, hover
`accent`.

**Card** — `bg-card`, `rounded-3xl`, borde 1px, `shadow-surface`. Padding 16px en
móvil, 24px desde `sm`.

**Input / Select / Textarea** — `rounded-sm`, borde `input`, foco con
`ring` verde. El foco se ve, siempre.

**Badge** — `rounded-full`, `text-xs`, peso 500. Para estados usá los tokens
`status-*` con fondo al 15% de opacidad.

**Banda de cierre (sólo landing)** — línea horizontal de 4px con degradé
`primary-pressed → primary → primary-soft`, ancho completo, arriba del footer.
En el panel **no va**: una app de trabajo no se firma en cada pantalla.

## Qué no hacer

- No usar botones píldora.
- No agregar acentos fuera del verde: los colores de estado son información,
  no paleta.
- No poner texto blanco sobre el verde: el texto es `primary-foreground`
  (`#101010`).
- No editar `components/ui/` salvo un cambio del sistema que tenga que vivir ahí.
- No usar colores crudos (`bg-[#00d992]`): saltean el tema.
- No reintroducir un tema claro "sólo para la landing".
- No cargar fuentes desde Google Fonts.

## Responsive

La landing es mobile-first: una columna bajo `sm`, grillas de 2 desde `sm`, de
3–4 desde `lg`. El contenedor es `max-w-6xl` con gutter de 24px.

Objetivos táctiles de 44px efectivos en móvil. Altura de viewport: `100dvh`,
nunca `100vh` — en iOS el `100vh` incluye la barra del browser.
