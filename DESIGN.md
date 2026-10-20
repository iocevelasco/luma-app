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

Técnica, sobria, nocturna. **No hay switch de tema.** La landing, el login y el
*chrome* del panel (header, sidebar, riel, barra inferior) son oscuros. El
**área de contenido del panel** es una superficie clara (`.surface-light`, ver
abajo): texto claro sobre `#101010` durante horas de tablas y formularios cansa
la vista.

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

### Superficie clara del panel

`.surface-light` redefine los **mismos tokens** (no hay clases nuevas en los
componentes). `DashboardLayout` la pone en el área de contenido y en `<body>`
mientras está montado, para que dialog, select y toast —que son portales— no
abran oscuros.

| Token | Hex |
|---|---|
| `background` | `#f4f4f5` |
| `card` / `popover` | `#ffffff` — opacos, nunca `bg-card/50` |
| `foreground` / `muted-foreground` | `#18181b` / `#52525b` |
| `border` / `input` | `#e4e4e7` / `#d4d4d8` |
| `brand` | `#047857` — el verde `#00d992` no alcanza como texto sobre blanco |
| `primary` (relleno de CTA) | `#00d992`, texto `#101010` |

Sin ilustración de fondo en ninguna pantalla del panel.

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

### Tags (Badge)

Los tags de estado tienen su propia paleta, la misma en toda la app: píldora
tintada —un relleno muy suave del tono— con un **círculo de color vivo y el
glifo en blanco** adelante. Son cinco tonos más el azul macizo, y salen de los
tokens `tag-*` (`bg-tag-success-bg text-tag-success-fg`), no de `status-*`: los
`status-*` siguen para íconos, barras y gráficos.

Sobre la superficie clara del panel:

| Tono (`variant`) | Relleno | Texto | Círculo | Significa |
|---|---|---|---|---|
| `neutral` | `#f2f2f2` | `#3c3c43` | `#8e8e93` | Sin estado: categoría, rol, conteo, "sin empezar" |
| `info` | `#e8f1ff` | `#0b63ce` | `#0a7aff` | En camino, en curso, informativo |
| `success` | `#eaf6ee` | `#1e7f3e` | `#34b85f` | Hecho, aprobado, cobrado, en obra |
| `warning` | `#fff3ea` | `#a8520a` | `#ff9f4a` | Espera algo o vence pronto |
| `danger` | `#fdedec` | `#bf3128` | `#eb5a4e` | Falta o venció: pide acción |
| `solid` | `#0a6ce0` | `#ffffff` | `#ffffff` | Seleccionado o agregado — el único tag macizo |

**El texto es un paso más oscuro que el círculo, a propósito.** El naranja y el
verde "de catálogo" (`#ff9f4a`, `#34b85f`) sobre su relleno dan 1.9:1 y 2.3:1:
a 12px no pasan AA. Con el texto de la tabla todos llegan a ≥ 4.5:1 y el círculo
conserva el tono vivo de la referencia. El `solid` es el azul `#0a7aff` de la
referencia oscurecido a `#0a6ce0` (blanco sobre `#0a7aff` da 4.0:1).

Sobre el lienzo oscuro (`:root`) el relleno es el tono al ~16% y el texto su
versión clara; el círculo no cambia.

El color **no es lo único** que dice el estado: el texto lo nombra siempre y el
círculo (`aria-hidden`) lleva un glifo —`Check` hecho, `Clock` espera, `X`
falló, `ArrowRight` en camino, `Plus` falta—. Un daltónico lee el texto.

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
| `rounded-md` | 8px | Code blocks, filas internas |
| `rounded-lg` | 14px | Dialog, menú, dropdown, toast |
| `rounded-xl` | 18px | Popover grande, alert dialog |
| `rounded-2xl` | 22px | Panel destacado |
| `rounded-3xl` | **28px** | **Card** — el radio dominante |
| `rounded-full` | píldora | **Botones** —todas las variantes— y estados: Badge, Avatar, Switch, Slider, Progress |

Dos reglas:

1. **Los botones son píldora, y con relieve.** La forma la comparten con el
   badge; lo que dice "esto se toca" es el volumen (ver *Profundidad*). Un
   badge es plano y chico; un botón se levanta del lienzo. Una píldora plana
   y sin borde no es un botón.
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

### Relieve de los botones

| Rol | Qué es | Uso |
|---|---|---|
| `shadow-cta` | Bisel claro abajo, adentro, y sombra negra de apoyo | Botón con relleno: primario y destructivo |
| `shadow-raised` | Filete claro arriba y la misma sombra, sin bisel | Botón secundario — superficie neutra elevada |
| `shadow-cta-pressed` | Sombra interna: la luz se va adentro | `:active` de los dos anteriores |

El outline no lleva sombra: lo levanta el borde de 2px. Las sombras de afuera
son negras siempre — el relieve es luz y sombra, no un halo verde.

`cn()` registra estas sombras en `tailwind-merge` (`lib/utils.ts`): sin eso
las toma por un color de sombra y no resuelve el conflicto con `shadow-none`.

## Componentes

Los botones salen de una referencia de cuatro estados —elevado, contorno,
relleno con bisel, relleno con anillo— traducida al lienzo oscuro:

**Botón primario** — píldora, `bg-primary text-primary-foreground`, filete
`primary-pressed`, `shadow-cta`. Hover `primary-pressed`, `:active`
`shadow-cta-pressed`. Altura `h-9`, o `h-10` en `lg`.

**Botón secundario** — píldora, `bg-secondary`, `shadow-raised`. Hover sube el
brillo; `:active` igual que el primario.

**Botón outline** — píldora sin relleno, borde de 2px en `foreground` al 45%
(70% en hover), texto `foreground`. No va en verde: son los "Cancelar" y
"Volver" del panel, y el verde es para la acción principal.

**Foco de un botón** — anillo verde de 2px separado del botón por 2px de aire
(`outline` + `outline-offset`). Pegado, un anillo verde no se ve contra el
relleno verde. Va con `outline` y no con `ring` porque el ring es box-shadow y
pisaría el relieve.

En la landing los CTA son links, no `Button`: usan `CTA_PRIMARY` y
`CTA_OUTLINE` de `src/lib/cta.ts`, que son las mismas clases. La altura va con
`h-*`, no con `py-*`: el outline tiene 2px de borde y el primario 1px.

**Card** — `bg-card`, `rounded-3xl`, borde 1px, `shadow-surface`. Padding 16px en
móvil, 24px desde `sm`. Adentro, dos piezas apoyadas un escalón abajo
(`rounded-2xl`, relleno `background`, borde 1px):

- `CardTile` — acción chica con el ícono arriba y el rótulo abajo (Silenciar,
  Llamar, Buscar). Se arma en fila con `grid grid-cols-4 gap-2`.
- `CardList` — filas agrupadas con divisor entre una y otra. Las filas son
  `Item`s (`size="sm"`): el grupo les saca radio y borde y redondea el conjunto.
  Lo de la derecha (valor + chevrón) va en `ItemActions`.

`variant="interactive"` es la card que se toca entera: sube 2px y pasa a
`shadow-overlay`; con `prefers-reduced-motion` no se mueve. Va sobre un link o
un botón: la card no impone el rol.

**Breadcrumb** — el eslabón ancestro es tinta con subrayado a 40% (100% en
hover); la página actual va en `muted-foreground`, sin subrayado. El separador es
un chevrón. Los eslabones aceptan un ícono de 16px antes del rótulo. En el
header del panel el camino va sin ícono. `BreadcrumbList variant="pill"` es la
variante contenida: una píldora elevada con la página actual en relieve y sin
separadores, para una navegación corta que se lee como control.

**Input / Select / Textarea** — `rounded-sm`, relleno `field`. Los seis estados
salen de un solo lugar, `lib/field-styles.ts`; el editor Markdown, `InputGroup`
e `InputOTP` los repiten.

`field` es un token propio (`#f0f0f2` en el panel claro, `#252423` en el
oscuro) y **no** `background`: Dialog, Sheet y Drawer pintan su fondo con
`background`, y un campo del mismo color que su contenedor pierde el relleno
justo ahí. Con `field` se ve igual sobre una card, sobre el lienzo y dentro de
un Sheet.

| Estado | Qué cambia |
|---|---|
| Reposo | Borde `input`, relleno `field` |
| Hover | Borde de tinta al 65% |
| Foco | Borde y anillo de 3px en `ring` (verde); la etiqueta pasa a `brand` |
| Completo | Borde de tinta al 90%. Input y Textarea llevan un placeholder de un espacio cuando no traen uno, porque sin placeholder CSS no distingue vacío de lleno. Un `type="date"` no tiene este estado. En el Select, cuando ya tiene valor |
| Error | Borde `destructive` y anillo rojo **fijo**, sin esperar al foco |
| Deshabilitado | Relleno `field-disabled`, borde `border`, texto atenuado, `cursor-not-allowed` |

El error y el foco ganan siempre sobre hover y completo. El foco se ve, siempre.

**El error de un campo.** El campo se pinta en error cuando la instancia del
form dice que lo está: `aria-invalid={Boolean(errors.nombre)}` en el
`Input` / `Textarea` / `SelectTrigger`, con el mensaje de `errors.nombre`
debajo. Dentro de un `FormItem` lo pone solo. Todos los formularios de la app
están cableados así; un `Controller` con un campo propio (editor Markdown) usa
su prop `invalid`.

`index.css` trae además una red: un campo seguido de un `<p class="text-destructive">`
se pinta en error aunque nadie le haya puesto `aria-invalid`. Es una red para el
formulario que se olvidó, no una excusa; el hook de post-edición avisa si un
archivo tiene mensajes de error y ningún `aria-invalid`. La etiqueta toma
`brand` con el foco, en un `FormItem` o en un `Label` + campo adyacentes.

Un grupo de opciones (el público de un hito, el rol de un miembro) no es un
campo de texto: su mensaje queda debajo, sin borde rojo.

**Badge** — `rounded-full`, `text-xs`, peso 500, `px-3 py-1`. Se elige por
**tono** (`variant="success"`), no por color: ver *Tags*. Para sumarle el círculo
con glifo, `icon` (`true` usa el glifo del tono; o un ícono de Lucide propio).
Un conteo o una categoría es `neutral` sin ícono. Si el mismo estado aparece en
dos pantallas, el mapa estado → tono vive en un componente
(`MaterialStatusBadge`, `ActivityStatusBadge`) y no se repite. `outline` queda
para una etiqueta que no es un estado.

**Banda de cierre (sólo landing)** — línea horizontal de 4px con degradé
`primary-pressed → primary → primary-soft`, ancho completo, arriba del footer.
En el panel **no va**: una app de trabajo no se firma en cada pantalla.

## Qué no hacer

- No hacer un botón a escuadra ni una píldora plana: el botón es píldora con
  relieve.
- No agregar acentos fuera del verde: los colores de estado son información,
  no paleta. Los tags (`tag-*`) son esa información; no se usan como decoración.
- No pintar un tag con `bg-warning` ni con un hex: `variant` y los tokens `tag-*`.
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
