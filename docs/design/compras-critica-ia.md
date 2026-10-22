# Compras — crítica de arquitectura de la información

Pantalla: `packages/web/src/pages/projects/project-materials.tsx` (pestaña
"Por comprar", escritorio, rol con `material.write`). Evidencia: la captura de
octubre de 2026 y el código de la rama `claude/materials-provider-link`. Las
reglas que se citan (`IA-n`) están en
[`arquitectura-de-informacion.md`](arquitectura-de-informacion.md).

## Resumen ejecutivo

Compras tiene buena estructura de fondo: dos pestañas con conteo, grupos por
tarea ordenados por fecha de inicio, y una selección múltiple bien resuelta.
Lo que falla es la **jerarquía**: el encabezado de un grupo pesa igual que una
fila, la acción "Marcar …" es lo más visible de cada fila (más que el
material), y dos cosas distintas —"Solicitado" y "Empieza en 2 días"— se
pintan con el mismo tag naranja con reloj. Resultado: el ojo no encuentra
primero lo que frena una tarea (un material **Pendiente** de una tarea que
empieza pronto). Casi todo se arregla sin tocar datos ni agregar entidades.

---

## Problemas de arquitectura de la información

### Alta

#### A1. El encabezado de grupo se lee como una fila más

> **Aplicado** (rama `claude/materials-provider-link`): rótulo `GROUP_LABEL` único para `ToBuyGroup` y `BoughtGroup`.

- **Qué pasa.** "Fundaciones y platea" es `text-sm font-medium`
  (`ToBuyGroup`, línea ~430), el mismo estilo que el nombre de un material
  (`MaterialRow`, línea ~235). Lleva la misma casilla, del mismo tamaño y en la
  misma columna (`GroupCheckbox` → `SelectCheckbox`). En la captura, "Fundaciones
  y platea" y "Ladrillo hueco 18×18×33" son visualmente pares; la única pista de
  que uno contiene al otro es que el grupo no tiene línea 2.
- **Por qué importa.** Jerarquía visual y ley de semejanza: lo que tiene la
  misma forma se lee como del mismo nivel. Si el contenedor parece un ítem, la
  casilla de grupo parece "seleccionar este material" y no "seleccionar los de
  esta tarea".
- **Recomendación.** Darle al encabezado de grupo un tratamiento de rótulo, no
  de fila (IA-7): `text-xs font-medium uppercase tracking-wide
  text-muted-foreground` —el mismo que ya usan `BoughtGroup` (línea ~508) y
  Hitos—, o, si se quiere que la tarea pese más, una banda `bg-muted` de alto
  fijo. Un solo estilo para los dos tipos de grupo de la pantalla (hoy
  `ToBuyGroup` y `BoughtGroup` usan dos distintos). La casilla del grupo se
  queda, pero alineada con el rótulo y no con el título de una fila.

#### A2. La acción de la fila pesa más que el material

> **Aplicado**: `variant="ghost"` con `ArrowRight`, una sola acción visible por fila.

- **Qué pasa.** "Marcar comprado" / "Marcar solicitado" es un `Button
  variant="outline" size="sm"` con borde de 1px y texto `text-sm` (línea ~270).
  Repetido en cada fila arma una columna de píldoras con borde que es lo más
  contrastado de la tarjeta. El nombre del material, que es lo que se viene a
  leer, queda en segundo plano.
- **Por qué importa.** La primera fijación tiene que caer en *qué* es, no en
  *qué se puede hacer*: la acción se busca después de saber sobre qué se actúa.
  Además `DESIGN.md` reserva el outline para "Cancelar" y "Volver".
- **Recomendación.** Mantener **una** acción visible por fila (IA-11, está
  bien), pero bajarle el peso: `variant="ghost"` con `ArrowRight` y el rótulo,
  o el mismo outline sólo desde `sm` y un ícono en mobile. Validar en pantalla
  que el nombre gane la primera mirada. No usar el primario verde: con cuatro
  filas serían cuatro "acá se actúa".

#### A3. Dos significados con el mismo tag

> **Aplicado**: la urgencia del grupo usa `icon={CalendarClock}`; el reloj queda para "Solicitado".

- **Qué pasa.** El estado "Solicitado" (`MaterialStatusBadge`: `warning` +
  `Clock`) y la urgencia del grupo "Empieza en 2 días" (`Badge variant="warning"
  icon`, línea ~440, glifo por defecto del tono = `Clock`) son idénticos: mismo
  relleno, mismo círculo naranja, mismo reloj, uno arriba del otro.
- **Por qué importa.** Un código visual, un significado (IA-12). La persona
  tiene que leer el texto para saber si el naranja habla del material ("ya lo
  pedí, espero") o de la tarea ("se viene"). Es justo la diferencia entre "no
  hago nada" y "apurate".
- **Recomendación.** La urgencia es una dimensión de **tiempo**, no de estado:
  pasarle `icon={CalendarClock}` al `Badge` del grupo (el `Badge` ya acepta un
  Lucide propio). Si después de eso sigue confundiendo, bajar la urgencia a
  texto en `text-tag-warning-fg` sin píldora.

#### A4. Lo que más frena puede quedar último

- **Qué pasa.** `organizeMaterials` (`lib/materials.ts`, líneas 92–125) ordena
  los grupos por fecha de inicio y manda "Sin tarea asociada" al final. Adentro
  de cada grupo, lo Pendiente va antes que lo Solicitado (bien). Pero en la
  captura el **único** material Pendiente —"Hierro del 8", el único que nadie
  encargó— está en la última fila de la pantalla, porque no tiene tarea.
- **Por qué importa.** La pestaña "Por comprar" existe para responder "¿qué
  tengo que pedir?". Hoy responde "¿qué se necesita primero?", que es otra
  pregunta. Con una lista larga, el pendiente sin tarea queda bajo el pliegue.
- **Recomendación.** No cambiar el orden por fecha (la lógica es correcta y
  está documentada). Hacer visible el conteo de lo que pide acción: en el
  rótulo de cada grupo, a la derecha, "N sin pedir" cuando N > 0 (derivado, no
  se guarda), y en la barra de la pestaña el total. Es información nueva, no
  un subtítulo que repite. **A validar con el cliente** antes de implementar:
  la alternativa es subir "Sin tarea asociada" al principio cuando tiene
  pendientes, que rompe la regla "sin X va al final" (IA-7).

### Media

#### M1. La fecha del grupo se dice dos veces

- **Qué pasa.** "Empieza el 24 oct 2026" + "Empieza en 2 días" (líneas
  ~434–446). Dos frases que empiezan igual y dicen lo mismo con dos relojes.
- **Por qué importa.** El cliente pidió sacar textos que repiten. Además
  compiten por el lado derecho del rótulo.
- **Recomendación.** Una sola expresión (IA-14): si es urgente, sólo el tag
  relativo ("En 2 días", "Hoy", "Ya empezó" — sin el "Empieza", que ya lo dice
  el contexto); si no, la fecha absoluta corta ("16 ene"). El año sólo si no es
  el corriente.

#### M2. El lápiz aparece sólo en algunas filas y corre la columna de estado

- **Qué pasa.** El lápiz (`Pencil`, líneas ~286–297) sólo se dibuja si
  `material.editable` (Pendiente). En la captura, el badge "Pendiente" de Hierro
  del 8 queda ~50px más a la izquierda que los "Solicitado" de arriba. Además
  "Editar" ya está en el menú "…" de esa misma fila (línea ~326).
- **Por qué importa.** El estado tiene que estar en una columna fija para
  escanearse en vertical (IA-10). Y dos caminos visibles a la misma acción en
  la misma fila es ruido.
- **Recomendación.** Sacar el lápiz suelto. Editar se entra tocando el nombre
  del material (link/botón que abre `MaterialDrawer`, como el título de
  `MilestoneCard`) y desde el "…". Si no hay nada que editar, el nombre no es
  interactivo. Con eso el bloque derecho queda siempre igual: badge → acción →
  "…".

#### M3. Exportar: tres botones del mismo peso, y otro lugar con selección

- **Qué pasa.** Sin selección, "Descargar PDF", "Copiar lista" y "Compartir"
  son tres outline arriba de la lista (líneas ~969–994). Con selección, las
  tres pasan al menú "…" de la barra (líneas ~637–655). Es la misma acción
  sobre otro alcance, en otro lugar y con otra forma.
- **Por qué importa.** Exportar es de segundo orden (IA-3): no puede competir
  con las acciones de las filas. Y la consistencia de ubicación es lo que hace
  que una acción se encuentre la segunda vez.
- **Recomendación.** Un solo control "Exportar" (o "Compartir lista") con menú:
  PDF, Copiar, Compartir. El mismo control en los dos estados; con selección
  el rótulo dice el alcance ("Exportar 3"). Sigue siendo exclusivo de "Por
  comprar". Ojo con Safari: el PDF tiene que generarse dentro del gesto (hoy
  ya se precargan los chunks, línea ~790; mantenerlo).

#### M4. Las pestañas viven dentro del contenido, no en la barra de la pantalla

- **Qué pasa.** `TabsList` está dentro de `children` (línea ~950), así que se
  angosta a `max-w-4xl`, y la barra de `PageLayout` (`toolbar` /
  `secondaryActions`) queda sin usar. Personal (`project-labor.tsx`, línea ~96)
  pone sus pestañas en `toolbar`. Además la pestaña no está en la URL: un
  recargue o un "atrás" vuelve siempre a "Por comprar" (Personal usa `?tab=`).
- **Por qué importa.** El esqueleto de pantalla es uno (IA-4); si cada vista
  ubica sus pestañas donde quiere, la persona las busca en dos lugares.
- **Recomendación.** Pasar `TabsList` a `toolbar` envolviendo `PageLayout` con
  `Tabs`, como Personal, y llevar la pestaña a `?tab=bought`, respetando
  `?material=` (la pestaña del material resaltado gana al llegar).

#### M5. En "Comprados" la fila repite el grupo

- **Qué pasa.** En "Comprados" los grupos son por estado ("Comprados, falta que
  lleguen" = `comprado`, "Ya en obra" = `en_obra`) y cada fila igual muestra el
  `MaterialStatusBadge` del mismo estado. Y el rótulo "Comprados, falta que
  lleguen" repite la palabra de la pestaña.
- **Por qué importa.** No se repite en la fila la dimensión por la que se
  agrupó (IA-8). Lo que sí está bien: ahí la fila suma la tarea en la línea 2,
  porque el grupo ya no la dice.
- **Recomendación.** En `BoughtGroup` no dibujar el badge (o dibujarlo sólo en
  "Por comprar", donde el grupo es por tarea). Rótulos: "En camino" y "En obra".
  El conteo del grupo se mantiene.

### Baja

#### B1. Vacíos con dos tratamientos

- `total === 0` usa `PageLayout empty` sin `description` (línea ~937): falta
  "qué puedo hacer" (`EmptyState` lo pide). Los vacíos de pestaña ("No hay nada
  por comprar.", líneas ~997 y ~1024) son un `<p>` suelto. Recomendación: una
  descripción para el vacío total cuando hay `material.write` ("Agregá el
  primero con el botón de abajo" o equivalente) y el vacío de pestaña como
  `EmptyState` compacto (IA-5).

#### B2. Una sugerencia dentro de la línea de metadatos

- El link "Vincular" (líneas ~245–261) es una acción metida en la línea 2. Está
  bien que exista sólo cuando hay match (no ensucia filas viejas), pero rompe
  "línea 2 = datos". Se acepta como **excepción documentada** (IA-9): una
  sugerencia contextual, nunca una acción recurrente.

---

## Pulido visual

- **Línea 2 demasiado grande.** `text-muted-foreground` hereda `text-sm` de la
  fila (línea ~236); en Gastos, Cobros y Equipo es `text-xs`. En la captura la
  línea 2 casi empata con el nombre. Pasar a `text-xs` (IA-9).
- **"107 Unidad".** La unidad sale en singular y con mayúscula
  (`material.unit.un = "Unidad"`) para cualquier cantidad. Usar plural de
  i18next (`unit_one`/`unit_other`) o abreviaturas (u., m², kg) en minúscula.
  Las claves nuevas van a `es`, `es-ES` y `pt`.
- **Radio del contenedor.** `TabsContent` usa `rounded-lg` (14px, el de
  dialog/menú, líneas ~961 y ~1021). La superficie que contiene una lista es
  una Card: `rounded-3xl`. Mejor todavía: usar `Card` + `CardList`
  (`components/ui/card.tsx`, existe y no lo usa nadie). Mismo comentario para
  `ResponsiveTable` (verificar con DESIGN.md si la tabla es excepción).
  *Superado:* la lista ya no va dentro de un contenedor; cada fila es su
  propia tarjeta y los grupos se separan con rótulo + divisor (IA-15 nueva,
  `components/common/row-card-list.tsx`).
- **Aire entre grupos.** `gap-5` (20px) entre grupos con la línea *debajo* del
  rótulo: el grupo se separa por aire arriba y por línea abajo. Con el rótulo
  nuevo (A1), `gap-6` entre grupos y sin línea bajo el rótulo, la divisoria
  queda sólo entre filas.
- **"Seleccionar todos".** Gris y a la izquierda, en la misma fila que
  exportar. Está bien que no tenga peso; con M3 resuelto queda solo a la
  izquierda y exportar solo a la derecha.
- **Foco visible en la casilla de grupo** (captura, "Sin tarea asociada"): es el
  anillo del sistema, correcto; sólo se ve porque quedó el foco tras un click.

---

## Qué está bien y conviene preservar

- **Sin título propio en la pantalla** (línea ~933): el título lo pone
  `HeaderTitle` en el header. No reintroducir un `h1` ni un subtítulo.
- **Una acción primaria flotante** ("Agregar material", `PageLayout.action`) y
  el alta en drawer, no en un formulario fijo arriba (comentario de la línea
  ~102). Mientras hay selección el FAB se esconde: correcto.
- **Dos pestañas con conteo y "Por comprar" por defecto**: responde las dos
  preguntas reales y muestra que "Comprados" existe sin scrollear.
- **Orden por fecha de inicio de la tarea y Pendiente antes que Solicitado**
  dentro del grupo.
- **Selección múltiple tipo Gmail**: casilla por fila y por grupo, tri-estado
  real (`TriStateCheckbox`), "desde algunos el toque completa", la fila entera
  no selecciona (guantes), la barra reemplaza a las acciones de segundo orden,
  el paso siguiente como primario y el resto en "…", sólo acciones válidas
  para todo lo seleccionado (`bulkActionsFor`), se limpia al cambiar de
  pestaña, y en mobile se fija abajo. Es la **referencia** de IA-13.
- **Estado como badge con mapa único** (`MaterialStatusBadge`), con texto y
  glifo además del color.
- **Lo que no se puede hacer no se muestra** (lápiz ausente, nota en el menú
  en vez de ítem deshabilitado) y el aviso de bloqueo antes de salir de
  Pendiente.
- **Destructivos con confirmación** (`AlertDialog` para borrar y para cambios
  masivos) y foco devuelto al panel al cerrar.
- **Objetivos táctiles de 44px** en mobile en todos los controles de la fila.

## Lo que no se pudo verificar

- Sólo hay una captura, de escritorio, en "Por comprar". La pestaña
  "Comprados", la barra de selección activa y la vista de 375px se evaluaron
  por código, no en pantalla.
- No se midió contraste ni se probó con lector de pantalla.
- La propuesta A4 depende de cómo usa la pantalla el cliente; no hay datos de
  uso.
