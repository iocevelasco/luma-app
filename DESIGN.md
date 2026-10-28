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
| `rounded-md` | 8px | **Botones**, **buscador** y la **pestaña** de un Tabs; code blocks, filas internas de un control |
| `rounded-lg` | 14px | **Contenedor de un Tabs**, Dialog, menú, dropdown, toast |
| `rounded-xl` | 18px | Popover grande, alert dialog, bloque de la izquierda de una fila-tarjeta |
| `rounded-2xl` | 22px | Panel destacado, **fila-tarjeta** de una lista |
| `rounded-3xl` | **28px** | **Card** — el radio dominante |
| `rounded-full` | píldora | Estados y marcas: Badge, Avatar, Switch, Slider, Progress. **No** los botones |

Dos reglas:

1. **Un solo criterio para los controles del panel: el de los Tabs.** Cuadrado
   de esquinas suaves (`rounded-md`; el contenedor, `rounded-lg`), superficie
   blanca (`bg-card`), **sin borde** y con la sombra suave `shadow-surface`.
   Lo comparten el Tabs, el botón (`outline`, ghost) y el buscador
   (`SearchField`). Lo que dice "esto se toca" es el relleno y la sombra, no
   un marco: **no hay variante "de contorno"**. La pestaña seleccionada y el
   hover se marcan con un gris (`muted`/`accent`), no con un borde.
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
| plano | borde 1px `border`, sin sombra | Divisores, inputs |
| `shadow-surface` | `0 1px 2px rgb(0 0 0 / .3), 0 8px 24px -12px rgb(0 0 0 / .5)` | Card y fila-tarjeta en reposo |
| `shadow-overlay` | `0 20px 60px rgb(0 0 0 / .7)` + filete interno | Dialog, menú, popover |
| `shadow-lift` | `0 1px 2px` + `0 16px 32px -12px` | Fila-tarjeta bajo el puntero o con el foco adentro |

Nada de `shadow-glow`: un resplandor de marca no es profundidad.

### Relieve de los botones

| Rol | Qué es | Uso |
|---|---|---|
| `shadow-cta` | Bisel claro abajo, adentro, y sombra negra de apoyo | Botón con relleno: primario y destructivo |
| `shadow-raised` | Filete claro arriba y la misma sombra, sin bisel | Botón secundario — superficie neutra elevada |
| `shadow-cta-pressed` | Sombra interna: la luz se va adentro | `:active` de los dos anteriores |

El outline lleva `shadow-surface` y fondo `card`, sin borde: lo levanta la sombra
suave, la misma de los tabs. Las sombras de afuera son negras siempre — el
relieve es luz y sombra, no un halo verde.

`cn()` registra estas sombras en `tailwind-merge` (`lib/utils.ts`): sin eso
las toma por un color de sombra y no resuelve el conflicto con `shadow-none`.

## Componentes

Los botones salen de una referencia de cuatro estados —elevado, contorno,
relleno con bisel, relleno con anillo— traducida al lienzo oscuro:

**Botón primario** — `rounded-md`, `bg-primary text-primary-foreground`, filete
`primary-pressed`, `shadow-cta`. Hover `primary-pressed`, `:active`
`shadow-cta-pressed`. Altura `h-9`, o `h-10` en `lg`.

**Botón secundario** — `rounded-md`, `bg-secondary`, `shadow-raised`. Hover sube el
brillo; `:active` igual que el primario.

**Botón outline** — `rounded-md`, fondo `card` (blanco), `shadow-surface`, **sin
borde**, texto `foreground`; hover en `accent`. No va en verde: son los
"Cancelar" y "Volver" del panel, y el verde es para la acción principal.

**Botón ghost** — `rounded-md`, sin fondo ni borde; hover en `accent`. Es el de
los íconos sueltos (anterior/siguiente, "…").

**Buscador** — `SearchField` (`components/common/search-field.tsx`): `rounded-md`,
`bg-card`, `shadow-surface`, sin borde, lupa a la izquierda. El foco es el anillo
verde. Los demás campos de un formulario conservan su borde: es lo que dice
"acá se escribe"; un buscador es un control de la barra, no un campo.

**Tabs** — la base del criterio. Contenedor `rounded-lg` blanco con
`shadow-surface`; cada pestaña `rounded-md`, `h-9`, **siempre con ícono**; la
activa en `bg-muted` y el fondo se desliza de una a otra (300 ms).

**Card de obra (inicio del panel)** — `ProjectCard` en `admin-home.tsx`. Es la
pieza más central de la app —es desde donde se entra a trabajar—, así que tiene
su propio lenguaje: oscura (`surface-dark`), sombreada de arriba hacia abajo (un
gris que se apaga hasta el negro) y con una textura de puntos (`luma-project-card`,
en `index.css`). El orden, de arriba abajo, es el de una tarjeta de referencia
—la marca, lo que es, sus etiquetas y, al pie, el dato y la acción— con un solo
nivel que compite por la mirada: el nombre de la obra.

| Zona | Qué | Cómo |
|---|---|---|
| Arriba | La marca de la obra y en qué momento está | Casco en un cuadrado translúcido (`size-10 rounded-md bg-foreground/10`); a la derecha una pastilla `rounded-md bg-foreground/10 text-xs` con un punto de color: "Por empezar" (warning), "En curso" (primary), "Finalizada" (gris). La fase **se calcula** de las fechas, no se guarda |
| Qué es | Dónde, con cuánto falta, y el nombre | Ubicación `text-base` con pin; al lado, en `text-xs` gris, "Termina dentro de 5 meses" / "Empieza…" / "Terminó hace…"; el nombre, `text-2xl font-medium`: lo único grande |
| Etiquetas | Moneda y tamaño | Pastillas translúcidas `rounded-md bg-foreground/10 text-xs` |
| Pie | Las fechas y la forma de entrar | Divisor `bg-foreground/15` (con `mt-auto`: todas las cards de una fila alinean su pie); a la izquierda el rango de fechas (`text-base font-semibold tabular-nums`) con la duración debajo; a la derecha "Abrir" en blanco (`bg-foreground text-background`) |

Toda la tarjeta es el enlace. El "Abrir" del pie **no es un `Button`** sino la
forma de uno (un `span` `aria-hidden`): un botón dentro de un enlace anida dos
controles interactivos. Radio `rounded-3xl` (28px), el de toda card; el chip y
el "Abrir", `rounded-md` como todo control. Al pasar el puntero la tarjeta sube
2px.

**Tarjeta de actividad (Tablero)** — `TaskCardContent` dentro de la columna de
`@svar-ui/react-kanban`, oscura (`surface-dark`) y plana, con el orden de IA-9:
el rubro como antetítulo (`text-2xs uppercase`) y el nombre (`text-sm
font-medium`) arriba, con el "…" a la derecha; el motivo de una devolución en su
bloque `bg-destructive/15`; abajo, avatar con iniciales y nombre a la izquierda y
las fechas con ícono a la derecha; el atraso, un `Badge danger` con reloj.

**Paleta del Tablero** — propia del Kanban de Actividades, tomada de una pieza
de referencia (valores medidos de la imagen, no estimados). Son tokens globales
`--board-*` en `index.css`:

| Token | Valor | Dónde |
|---|---|---|
| `--board-canvas` | `#434343` | Fondo de las columnas (y de la lista del celular) |
| `--board-card` | `#1f1f21` | La tarjeta de actividad |
| `--board-ink` | `#f5f5f7` | Texto: nombre, encabezados de columna |
| `--board-ink-muted` | `--board-ink` al 62 % sobre la tarjeta | Segundo orden: avatar, fechas, rubro, íconos de columna |
| `--board-accent` | `#ff3d02` | Sólo el destino de un arrastre (el marcador punteado donde va a caer la tarjeta). **No** es un estado ni un relleno: el atraso y las devoluciones usan los tags y el rojo del sistema |

Contraste (WCAG): `--board-ink` sobre la tarjeta ~15:1 y sobre el gris ~9:1; el
acento sobre la tarjeta ~4,6:1, así que sirve de trazo o de relleno pero no de
tinta de texto chico sobre el gris (ahí daría ~2,8:1). Es la excepción declarada
a "un solo verde": el acento naranja vive **dentro del Tablero**, sólo marca el
destino de un arrastre y nunca es el relleno de una acción; fuera de él, la marca
sigue siendo el verde.

**Los estados de la tarjeta usan los tags de la app**, no colores propios: el
"Atrasada" es el `Badge danger` de siempre (en su tono suave del lienzo oscuro) y
el motivo de una devolución usa el rojo `destructive`. La tarjeta lleva
`surface-dark` junto a `luma-task-card`: la segunda pisa sólo `--foreground` y
`--muted-foreground` con la paleta; los tokens de tags y de peligro se dejan como
están.

Radios: la columna tiene la mitad del de una card (`--radius-lg`, 14px) y la
tarjeta, un escalón abajo (`--radius-md`, 8px, el de un botón): el hijo, un
escalón abajo del padre. **El aspecto vive en el contenido** (`TASK_CARD` en `task-board.tsx`) y no
en la caja `.wx-card` de la librería, que queda neutra: la librería dibuja la
tarjeta que se arrastra (`.wx-ghost`) fuera de `.wx-board` y sin las clases de
`cardCss`, y cualquier regla que dependiera de esos dos lugares se perdía al
arrastrar. El mismo contenido se usa en la lista de canceladas y en la del
celular.

**Cronograma (SVAR Gantt)** — superficie blanca (`bg-card`, `shadow-surface`) con
la mitad del radio de una card (`rounded-lg`, 14px); renglones y columnas
separados con una línea (`#d4d4d8`); los headers —los de la tabla y los de la
escala de tiempo— son rótulos: `text-2xs` (11px), negrita y mayúsculas.

**Card** — `bg-card`, `rounded-3xl`, borde 1px, `shadow-surface`. Padding 16px en
móvil, 24px desde `sm`. Adentro, dos piezas apoyadas un escalón abajo
(`rounded-2xl`, relleno `background`, borde 1px):

- `CardTile` — acción chica con el ícono arriba y el rótulo abajo (Silenciar,
  Llamar, Buscar). Se arma en fila con `grid grid-cols-4 gap-2`.
- `CardList` — **no se usa para listas del panel.** Las listas van en
  filas-tarjeta (ver *Listas*); `CardList` queda sólo para un grupo corto de
  ajustes dentro de una card.

`variant="interactive"` es la card que se toca entera: sube 2px y pasa a
`shadow-overlay`; con `prefers-reduced-motion` no se mueve. Va sobre un link o
un botón: la card no impone el rol.

**Listas y tablas** — cada fila es su propia tarjeta, separada de las demás.
Es la única forma de lista del panel: tablas, listas de entidades, historiales.
Vive en `components/common/row-card-list.tsx`; `ResponsiveTable` la usa por
dentro.

```
COMPRAS DE OBRA ───────────────────────────────── 3      ← ListSection
╭──────────────────────────────────────────────────╮
│ [OCT]  Ladrillo hueco 18          [Estado] Acción → … │  ← RowCard
│ [ 9 ]  1200 un · Corralón Sur                        │
╰──────────────────────────────────────────────────╯
                     12px
╭──────────────────────────────────────────────────╮
│ …                                                │
```

- **La fila** (`RowCard`, o `ROW_CARD` si no es un `<li>`): `bg-card`,
  `rounded-2xl`, **sin borde**, `shadow-surface`, `p-4` (`sm:px-5`), y 12px de
  aire entre filas (`RowCardList`, `gap-3`). La separación la dan el lienzo y
  el aire, no una línea. Sobre el lienzo claro del panel es blanco sobre gris.
- **Bajo el puntero** la fila sube a `shadow-lift` y su acción visible
  (`RowCardAction`) pasa de texto liviano a relleno `foreground`. Con el foco
  dentro de la fila pasa lo mismo: el teclado ve lo que ve el mouse.
- **Bloque de la izquierda** (`RowCardLead`, opcional): una fecha
  (`RowCardDate`: mes arriba, día grande; el año sólo si no es el corriente) o
  un ícono, tintado con un tono de estado. `rounded-xl`, un escalón abajo de
  la fila. Si la fecha va en el bloque, la línea 2 no la repite.
- **Cuerpo** (`RowCardBody`): línea 1 = qué es, línea 2 = metadatos en
  `text-xs` muted, separados por `" · "`. **Bloque derecho** (`RowCardEnd`):
  estado, monto, acción, "…"; en celular baja a su propia línea antes que
  salirse de la tarjeta.
- **Grupos** (`ListSection` dentro de `ListSections`): rótulo chico en
  mayúsculas y atenuado, un **divisor** de 1px que corre hasta el borde y el
  metadato (conteo, total, fecha) a la derecha. 32px entre grupos. El grupo
  nunca es otra caja: una caja alrededor de filas-tarjeta es una tarjeta más.
- **Tabla** (`ResponsiveTable`): en escritorio cada fila es una tarjeta y las
  columnas se alinean entre filas con `grid-cols-subgrid`; los encabezados van
  sueltos arriba, con el estilo del rótulo de grupo. En celular, la misma
  tarjeta con los datos apilados.
- La lista va **directo sobre el lienzo**, nunca dentro de una `Card`: blanco
  sobre blanco no separa nada.
- En celular, todo control de la fila mide 44px (`max-sm:min-h-11`).
- No aplica a listas dentro de un diálogo o un drawer (selectores, pickers):
  ahí la lista es parte de un control y va compacta.

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

- No hacer un botón píldora ni con borde de contorno **en el panel**: el botón es
  cuadrado de esquinas suaves, con relleno y sombra. Un marco de 1px no lo
  distingue del lienzo y rompe la familia con los tabs y el buscador.
- No agregar acentos fuera del verde: los colores de estado son información,
  no paleta. La única excepción es la paleta propia del Tablero (ver arriba), que no
  sale de él. Los tags (`tag-*`) son esa información; no se usan como decoración.
- No pintar un tag con `bg-warning` ni con un hex: `variant` y los tokens `tag-*`.
- No poner texto blanco sobre el verde: el texto es `primary-foreground`
  (`#101010`).
- No editar `components/ui/` salvo un cambio del sistema que tenga que vivir ahí.
- No usar colores crudos (`bg-[#00d992]`): saltean el tema.
- No armar una lista con `divide-y` ni con una caja alrededor de las filas:
  cada fila es su `RowCard`, y los grupos se separan con `ListSection`.
- No reintroducir un tema claro "sólo para la landing".
- No cargar fuentes desde Google Fonts.

## Responsive

La landing es mobile-first: una columna bajo `sm`, grillas de 2 desde `sm`, de
3–4 desde `lg`. El contenedor es `max-w-6xl` con gutter de 24px.

Objetivos táctiles de 44px efectivos en móvil. Altura de viewport: `100dvh`,
nunca `100vh` — en iOS el `100vh` incluye la barra del browser.
