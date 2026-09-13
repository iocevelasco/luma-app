# Sistema de diseño de Luma

Fuente de verdad única. Lo implementan `packages/web/src/index.css` y
`packages/landing/src/index.css`; si algo de acá y algo del CSS no coinciden,
manda este archivo y el CSS está mal.

Antes había dos sistemas —el rojo `#EF233C` del panel y el "lenguaje de cero" de
la landing— y ninguno de los dos existe más. Un producto, una voz.

## La voz

Editorial y templada. Un serif de display contra un sans neutro, superficies
crema en vez de gris, y un naranja saturado que aparece poco y cuando aparece
significa "acá se actúa".

La geometría es sobria: **no hay botones píldora**. La píldora queda para lo que
es un estado, no una acción — badges y avatares. Un botón de 8px y una card de
12px se leen como documento; todo píldora se lee como juguete.

## Color

### Marca

El naranja se parte en dos tokens, y no es un capricho: **`#fa520f` con texto
blanco encima da 3.34:1 y no pasa AA.** Es el valor que publica la referencia y
tomado literal deja cada CTA del producto por debajo del mínimo legible.

| Token | Hex | Qué es | Contraste |
|---|---|---|---|
| `brand` | `#fa520f` | La marca. Tinta sobre oscuro, ícono, borde, acento | 5.54:1 sobre el fondo oscuro |
| `brand-fill` | `#cc3a05` | **Relleno** de CTA en tema claro, con texto blanco | 5.03:1 con blanco |
| `brand-press` | `#a82f04` | Estado presionado | — |

Sobre tema oscuro el relleno **sí** es `brand` (`#fa520f`) pero el texto encima
es `ink`, no blanco: negro sobre ese naranja da 4.93:1, blanco da 3.34:1. La
misma superficie cambia el color del texto según el tema. Está resuelto en los
tokens, no lo decidas por componente.

El naranja se reserva para CTA primario, estado activo y la banda de cierre. No
es un color decorativo.

### Crema y neutros cálidos

| Token | Hex | Uso |
|---|---|---|
| `cream` | `#fff8e0` | Paneles de formulario, cards destacadas, footer |
| `cream-soft` | `#fffaeb` | Variante más liviana |
| `cream-deep` | `#fff0c2` | Chips y tags |
| `beige` | `#e6d5a8` | Filete de 1px de las superficies crema |

### Sol — sólo para la banda de cierre

`sunshine-300 #ffd06a` · `sunshine-500 #ffb83e` · `sunshine-700 #ffa110` ·
`yellow #ffd900`. Existen para el gradiente de la banda y para nada más. No son
una paleta de acentos.

### Tinta

`ink #1f1f1f` · `slate #4a4a4a` (secundario) · `steel #6a6a6a` (terciario,
5.09:1 sobre crema) · `muted #a8a8a8` (deshabilitado, placeholders).

`stone #8a8a8a` da 3.45:1 sobre blanco: **no lo uses para texto**, sólo para
íconos decorativos o filetes.

### Estados

Ahora que la marca es naranja, el rojo quedó libre para significar peligro de
verdad — antes el CTA y el error eran el mismo color, que es exactamente el
problema que un sistema de diseño tiene que evitar.

`destructive #C81E32` (5.69:1 con blanco) · `success #157F3D` (5.08:1) ·
`warning #A15C07`.

### Tema oscuro

La referencia no tiene tema oscuro publicado; este está derivado acá. El fondo
es **charcoal cálido**, no el azulado de antes: un gris frío debajo de un naranja
lo ensucia.

`background #16130E` · `card #1F1B14` · texto `#FFF7EC` (17.44:1) ·
cuerpo `#C4BAA8` (9.65:1) · muted `#948A79` (5.44:1, el piso).

En oscuro no hay superficies crema: la crema es un tema claro. Su rol —"esta
superficie es cálida y distinta"— lo cumple `card` sobre `background`.

## Tipografía

**Display — Instrument Serif.** La referencia usa PP Editorial Old, que es
comercial y no se puede empaquetar. Instrument Serif es el near-serif libre más
cercano en Google Fonts: misma tensión clásica, mismo comportamiento en tamaños
grandes. Si algún día se compra la licencia de PP Editorial Old, se cambia una
línea del `@theme` y nada más.

**UI — Inter.** Body, navegación, botones, labels.

**Código — JetBrains Mono.**

| Rol | Tamaño | Peso | Interlínea | Tracking | Familia |
|---|---|---|---|---|---|
| hero | 84px | 400 | 1.05 | -1.5px | serif |
| display | 64px | 400 | 1.10 | -1px | serif |
| h1 | 52px | 400 | 1.15 | -0.5px | serif |
| stat | 56px | 400 | 1.10 | -1px | serif |
| h2 | 36px | 500 | 1.20 | -0.5px | sans |
| h3 | 28px | 500 | 1.25 | 0 | sans |
| h4 | 22px | 500 | 1.30 | 0 | sans |
| h5 | 18px | 500 | 1.40 | 0 | sans |
| subtitle | 18px | 400 | 1.50 | 0 | sans |
| body | 16px | 400 | 1.55 | 0 | sans |
| body-sm | 14px | 400 | 1.50 | 0 | sans |
| caption | 13px | 400 | 1.40 | 0 | sans |
| micro | 12px | 500 | 1.40 | 0 | sans |
| eyebrow | 11px | 600 | 1.40 | 1px, mayúsculas | sans |
| button | 14px | 500 | 1.30 | 0 | sans |
| code | 14px | 400 | 1.50 | 0 | mono |

El tracking negativo crece con el tamaño y se relaja a 0 antes de los 28px.
El contraste serif/sans **es** la voz: un hero en Inter no es este sistema.

Piso de tamaño: 11px, y escrito en `rem`. Un `text-[10px]` en px no responde al
tamaño de texto del sistema operativo, justo en los rótulos que más lo necesitan.

## Radio

Escala de la referencia, no la que había antes.

| Clase | Valor | Dónde |
|---|---|---|
| `rounded-xs` | 4px | Chips micro, indicadores |
| `rounded-sm` | 6px | Controles compactos |
| `rounded-md` | **8px** | **Botones**, inputs, select, code blocks |
| `rounded-lg` | **12px** | **Cards**, dialog, popover, panel — el radio dominante |
| `rounded-xl` | 16px | Paneles grandes que envuelven cards |
| `rounded-2xl` | 20px | Card destacada, bottom sheet |
| `rounded-full` | píldora | **Sólo** badges, avatares, switch, slider, progress |

Dos reglas que siguen valiendo:

1. **El hijo va un escalón abajo del padre.** Un input `rounded-md` dentro de una
   card `rounded-lg`. Un radio interno mayor que el del contenedor deja una luz
   visible en la esquina.
2. **Nunca un radio arbitrario.** `rounded-[14px]` no existe.

Lo que cambió respecto del sistema anterior: **el botón dejó de ser píldora**.
La forma sigue diciendo qué es algo, pero ahora la píldora significa "esto es un
estado" (badge, avatar), no "esto se toca".

## Espaciado

Base 4px, incremento principal 8px. Usá la escalera numérica de Tailwind
(`p-4` = 16px), no tokens propios: declarar `--spacing-md` pisa las tallas
t-shirt y `max-w-md` deja de ser 28rem.

`4=1 · 8=2 · 12=3 · 16=4 · 20=5 · 24=6 · 32=8 · 40=10 · 48=12 · 64=16 · 96=24`

Sí hay dos tokens de sección porque no caen en la escalera:
`section` 64px · `section-lg` 96px · `hero` 120px.

Ritmo: la landing respira en `section-lg` (96px); el panel se ajusta a 64px.
Padding interno: 24px en cards compactas, 32px en paneles y formularios.

## Profundidad

Plana por defecto. La profundidad la dan el filete de 1px y el salto de
superficie, no una escalera de sombras.

| Rol | Valor | Uso |
|---|---|---|
| plano | sin sombra, borde 1px `hairline-soft` | Cards, filas, inputs |
| `shadow-surface` | `0 4px 12px rgb(0 0 0 / 0.04)` | Card de producto destacada |
| `shadow-overlay` | `0 16px 48px -8px rgb(0 0 0 / 0.12)` | Dialog, dropdown, barra fija |

No hay `shadow-glow`. Un resplandor de marca no es profundidad y era la forma
más fácil de elevar algo que no debía estar elevado.

## Componentes

**Botón primario** — relleno `brand-fill` + texto blanco en claro;
relleno `brand` + texto `ink` en oscuro. `rounded-md`, padding `10px 20px`,
altura efectiva 40–44px.

**Botón crema** — fondo `cream`, texto `ink`, borde 1px `beige`. La acción
secundaria natural sobre bandas crema.

**Botón secundario** — transparente, texto `ink`, borde 1px `hairline-strong`.

**Botón link** — texto `brand-fill` (no `brand`: sobre blanco `brand` da 3.34:1),
subrayado al activarse.

**Card** — fondo `card`, `rounded-lg`, padding 24px, borde 1px `hairline-soft`.
La variante crema cambia fondo a `cream` y borde a `beige`.

**Input** — `rounded-md`, altura 44px, borde 1px `hairline-strong`. Al foco el
borde pasa a 2px `brand`. El foco se ve, siempre.

**Badge** — `rounded-full`, 13px peso 600, padding `4px 10px`. Naranja, crema o
tinta.

**Tabs** — subrayado: inactivo `steel`, activo texto `brand` con borde inferior
de 2px. Las tabs píldora existen pero se usan poco.

**Banda de cierre** — gradiente horizontal
`brand → sunshine-700 → sunshine-500 → yellow → cream`, ancho completo, arriba
del footer, en todas las páginas de la landing. Es el elemento de continuidad de
la marca. En el panel autenticado **no va**: una app de trabajo no se firma en
cada pantalla.

## Qué no hacer

- No agregar acentos fuera de naranja / amarillo / crema. Los colores de estado
  son información, no paleta.
- No usar botones píldora.
- No reemplazar el serif de display por el sans. El contraste es la voz.
- No bajar la interlínea del hero de 1.05.
- No poner sombras pesadas en cards planas.
- No usar `brand` (`#fa520f`) como relleno con texto blanco: 3.34:1. Para eso
  está `brand-fill`.
- No meter la banda de cierre en el panel.

## Responsive

| Ancho | Cambios |
|---|---|
| < 480px | Una columna. Hero 40px. Nav a hamburguesa. Tabs a 44px de alto. |
| 480–767px | Tiles de a 2. Hero 52px. |
| 768–1023px | Grillas de a 2. Hero 64px. |
| 1024–1279px | Multi columna. Hero 76px. |
| ≥ 1280px | Hero 84px. Contenedor 1280px con gutters de 32px. |

Objetivos táctiles: botones e inputs a 44px efectivos. En móvil, todo control
sube a 44px aunque en desktop mida menos.

Altura de viewport: `100dvh`, nunca `100vh` — en iOS el `100vh` incluye la barra
del browser.
