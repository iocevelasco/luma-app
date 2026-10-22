# Arquitectura de la información del panel

Reglas de **qué va dónde** en una pantalla del panel. Complementan a
[`DESIGN.md`](../../DESIGN.md), que dice **cómo se ve** cada pieza: si las dos
chocan, manda `DESIGN.md` en lo visual y este archivo en la ubicación, el
orden y la jerarquía. Toda pantalla nueva las cumple; una existente que las
viola tiene una fila en la tabla del final.

Cada regla: la norma, un *por qué* de una línea y el componente que ya la
implementa, si existe.

---

## 1. Anatomía de una pantalla

```
┌ header (HeaderTitle) ── Obras › Obra › Título en serif ─────────────┐
│ toolbar: pestañas · filtros             secondaryActions: exportar… │
│                                                                     │
│   contenido (max-w-4xl por defecto)                                 │
│     grupo ─ rótulo                                    meta del grupo │
│       fila                                                           │
│       fila                                                           │
│                                                                     │
│                                              [ + acción primaria ]  │
└─────────────────────────────────────────────────────────────────────┘
```

**IA-1. El título lo pone el header; la pantalla no lleva título ni subtítulo.**
Por qué: el nombre de la sección ya está en el menú y en el header; repetirlo
empuja la lista abajo. Implementa: `HeaderTitle`
(`components/dashboard/navigation/page-header.tsx`).

**IA-2. Una sola acción primaria por pantalla, flotando abajo a la derecha.**
Siempre `PageLayout action`, esté la pantalla vacía o llena. Por qué: con dos,
ninguna es "la" principal, y el lugar fijo es lo que la hace encontrable.
Implementa: `PageLayout`.

**IA-3. Las acciones de segundo orden van en `secondaryActions`, arriba a la
derecha, y son pocas.** Exportar (PDF, copiar, compartir) es de segundo orden y
va en **un** control con menú, no en tres botones. Por qué: una acción de
segundo orden con el peso de una primaria le roba la mirada a la lista.
Implementa: `PageLayout secondaryActions` (Proveedores, Cobros, Personal).

**IA-4. Pestañas y filtros van en `toolbar`, arriba a la izquierda.** Las
pestañas llevan conteo y se reflejan en la URL (`?tab=`). Por qué: el mismo
control en el mismo lugar en todas las vistas, y un recargue o un "atrás" no
pierde dónde estaba. Implementa: Personal (`project-labor.tsx`), Documentos
(filtros), Cronograma.

**IA-5. Vacío de pantalla = `PageLayout empty`; vacío de un bloque =
`EmptyState` dentro del bloque.** El vacío dice qué falta **y** qué hacer
(`description`); si la persona no puede actuar, dice eso. El vacío no repite el
botón de la acción primaria: ya está en su lugar. Por qué: un vacío sin salida
es una pared, y un vacío distinto en cada pantalla parece un error distinto.
Implementa: `PageLayout`, `EmptyState`.

## 2. Contenido: pestañas, secciones, grupos

**IA-6. Pestañas cuando los conjuntos son excluyentes y se consultan por
separado; secciones cuando se leen juntos.** Una pestaña que pide acción va
primero y abre por defecto. Por qué: una pestaña esconde; sólo vale si lo
escondido no hace falta para entender lo visible. Ejemplos: Compras (por
comprar / comprados) usa pestañas; Cobros (cronograma + cobros) usa secciones.

**IA-7. Se agrupa por una sola dimensión, con un rótulo único y un orden
explicable.**
- El rótulo de grupo **no se parece a una fila**: `text-xs font-medium
  uppercase tracking-wide text-muted-foreground`, con su metadato (conteo,
  fecha, total) a la derecha.
- Orden de grupos: el que pide acción antes (fecha más próxima, urgencia). El
  grupo "Sin X" va siempre al final.
- Orden dentro del grupo: lo que pide acción antes que lo que espera.
- Por qué: si el contenedor tiene la forma de un ítem, se lee como un ítem más.
- Implementa: `ListSection` (`components/common/row-card-list.tsx`), en
  Compras, Gastos, Cobros, Hitos, Documentos, Presupuesto y Personal.

**IA-8. La fila no repite la dimensión del grupo.** Si se agrupa por estado, la
fila no lleva el badge de estado; si se agrupa por tarea, la fila no dice la
tarea (y si no está agrupada por tarea, la dice en la línea 2). Por qué: lo que
ya dijo el rótulo, repetido en cada fila, es ruido que tapa lo que cambia.
Implementa: `MaterialRow activityName` (sólo fuera del grupo por tarea).

## 3. Anatomía de una fila

```
[□]  Nombre de lo que es                         [Badge] [Acción] […]
     dato principal · contraparte · contexto
```

**IA-9. Línea 1 = qué es; línea 2 = metadatos.**
- Línea 1: `text-sm font-medium`, el nombre. Nada más compite en esa línea.
- Línea 2: `text-xs text-muted-foreground`, datos separados por `" · "`, en
  orden fijo por entidad: **dato principal** (cantidad, fecha) → **contraparte**
  (proveedor, método) → **contexto** (tarea, referencia). Un dato vacío se
  omite junto con su separador.
- Excepción documentada: una **sugerencia contextual** (el "Vincular" de
  Compras) puede ir al final de la línea 2, nunca una acción recurrente.
- El monto va a la derecha, `tabular-nums`, antes de las acciones.
- Por qué: un orden fijo deja leer la columna sin leer cada fila.

**IA-10. El estado es un badge, siempre en el mismo lugar.** Primer elemento
del bloque derecho, en una columna que no se corre: el bloque derecho tiene la
misma composición en todas las filas. El mapa estado → tono vive en un
componente (`MaterialStatusBadge`, `ActivityStatusBadge`), nunca en la página.
Por qué: el estado se escanea en vertical; si salta de lugar, hay que leer fila
por fila.

**IA-11. Una sola acción visible por fila —el paso siguiente— y el resto en
"…".**
- Visible: la acción que hace avanzar la fila ("Marcar comprado"), con menos
  peso que el nombre (ghost u outline chico, nunca el primario verde).
- Editar: tocando el nombre/título (abre el drawer) y desde "…". No un lápiz
  suelto además del menú.
- Destructivas (borrar, quitar, dar de baja): **siempre** en "…" y **siempre**
  con `AlertDialog`. Nunca un tacho visible que borra al toque.
- Lo que no se puede hacer no se muestra; si hace falta explicar por qué, va
  como texto en el menú.
- Por qué: N filas × M botones es una grilla de controles; la persona viene a
  leer la lista.
- Implementa: `MaterialRow` (menú, nota de bloqueo), `MilestoneCard` (título
  que abre edición + menú). Las piezas: `RowCardAction` (la visible),
  `RowCardMenu` + `RowCardMenuItem` (el "…", en `row-card-list.tsx`) y
  `ConfirmDialog` (`components/common/confirm-dialog.tsx`) para lo destructivo.

**IA-12. Un código visual, un significado por pantalla.** Dos tags con el mismo
tono y el mismo glifo no pueden decir cosas distintas en la misma vista
(estado vs. plazo). El plazo usa un glifo de calendario (`CalendarClock`); el
estado, el de su tono. Por qué: si hay que leer el texto para distinguirlos, el
color no está informando. Ver *Tags* en `DESIGN.md`.

## 4. Selección múltiple

**IA-13. Patrón único, el de Compras.**
- Casilla por fila, por grupo (tri-estado) y "Seleccionar todos" de la vista
  actual. La fila entera **no** selecciona.
- Con algo tildado, una barra (`role="toolbar"`) **reemplaza** a las acciones
  de segundo orden y el FAB se esconde. La barra: contador, la acción
  siguiente como primaria, el resto en "…", y cerrar.
- Sólo se ofrece lo que vale para **todo** lo seleccionado.
- La selección es de una pestaña: cambiar de pestaña la limpia.
- En mobile la barra se fija abajo, sobre el safe area.
- Las mismas acciones de segundo orden (exportar) se ofrecen con el mismo
  control con y sin selección; con selección, el rótulo dice el alcance.
- Por qué: es el modelo que la persona ya conoce (Gmail), y una sola
  implementación evita que cada lista invente el suyo.
- Implementa: `SelectionBar`, `TriStateCheckbox`, `bulkActionsFor`.

## 5. Textos

**IA-14. Ningún texto repite lo que la UI ya dice.**
- Sin subtítulos que expliquen la pantalla.
- El hijo no repite la palabra del padre: en la pestaña "Comprados", el grupo
  es "En camino", no "Comprados, falta que lleguen".
- Una fecha se dice una vez: relativa si es urgente ("En 2 días"), absoluta si
  no ("16 ene"); el año sólo si no es el corriente.
- Por qué: cada palabra repetida baja la densidad de lo que sí informa.

## 6. Densidad y espaciado

**IA-15. Una lista es una pila de filas-tarjeta; los grupos se separan con
rótulo y divisor.**
- Cada fila es su propia tarjeta (`RowCard`): `bg-card`, `rounded-2xl`, sin
  borde, `shadow-surface`, `p-4`. Entre filas, 12px de aire (`RowCardList`).
  La lista va directo sobre el lienzo, no dentro de una `Card`.
- Los grupos de una misma lista (por tarea, por estado, por categoría, por
  mes) son un `ListSection`: el rótulo de IA-7, un divisor de 1px que corre
  hasta el borde y el metadato a la derecha. Entre grupos, 32px
  (`ListSections`). El grupo **nunca** es otra caja.
- Las tablas (`ResponsiveTable`) siguen la misma regla: una tarjeta por fila,
  columnas alineadas entre filas, encabezados sueltos arriba.
- Bajo el puntero (o con el foco dentro) la fila sube (`shadow-lift`) y su
  acción visible (`RowCardAction`) se rellena: se ve qué fila se está por
  tocar antes de tocarla.
- Por qué: en una superficie con divisores las filas se funden y el ojo pierde
  la línea al ir del nombre a la acción; con la fila como unidad visible se
  escanea mejor, y el divisor queda reservado para lo que de verdad separa
  —un grupo de otro—. *Revierte la versión anterior de esta regla* ("una
  superficie con divisores, no una caja por fila"), por pedido explícito.
- Fuera de alcance: listas dentro de un diálogo o un drawer (selectores) y
  los resúmenes compactos del Resumen de la obra, que son parte de una card.
- Implementa: `components/common/row-card-list.tsx` (`RowCardList`,
  `RowCard`, `RowCardBody`, `RowCardEnd`, `RowCardLead`, `RowCardDate`,
  `RowCardAction`, `ListSection`, `ListSections`) y `ResponsiveTable`.
  `CardList` (`components/ui/card.tsx`) no se usa para listas.

## 7. Mobile

**IA-16. Lo de escritorio se reacomoda, no se esconde detrás de un gesto.**
- Objetivo táctil de 44px (`max-sm:min-h-11` / `max-sm:size-11`) en todo
  control de fila.
- Tablas: `ResponsiveTable` (la fila-tarjeta apila sus datos). Nada de scroll
  horizontal. El bloque derecho de una fila baja a su propia línea antes que
  salirse de la tarjeta (`RowCardEnd`).
- Nada que dependa de hover o de tooltip.
- Barras contextuales (selección) fijas abajo; el FAB sube sobre el safe area.
- Por qué: en obra se usa el celular, con una mano y a veces con guantes.

---

## Estado actual por vista

Revisado contra el código de la rama `claude/materials-provider-link`;
la fila de IA-15, contra `claude/row-cards`.
"sí" cumple, "no" viola, "parcial" cumple a medias, "—" no aplica.

| Regla | Compras | Proveedores | Gastos | Cobros | Documentos | Hitos | Equipo | Personal |
|---|---|---|---|---|---|---|---|---|
| IA-1 sin título propio | sí | sí | sí | sí | sí | sí | sí | sí |
| IA-2 una primaria flotante | sí | sí | sí | sí | sí | sí | sí | sí |
| IA-3 segundo orden arriba, agrupado | no ¹ | sí | — | sí | — | — | — | sí |
| IA-4 pestañas/filtros en toolbar, en URL | parcial ² | — | — | — | sí | — | — | sí |
| IA-5 vacío con salida | parcial ³ | sí | sí | sí | sí | sí | — | — |
| IA-7 rótulo de grupo único | no ⁴ | — | parcial ⁵ | parcial ⁵ | parcial ⁵ | sí | — | — |
| IA-8 la fila no repite el grupo | parcial ⁶ | — | sí | sí | sí | sí | — | — |
| IA-9 línea 1 / línea 2 | parcial ⁷ | sí | sí | sí | — | parcial ⁸ | sí | — |
| IA-10 estado en lugar fijo | parcial ⁹ | — | — | no ¹⁰ | — | parcial ⁸ | — | — |
| IA-11 una acción + "…", destructivo confirmado | parcial ⁹ | sí ¹¹ | sí ¹² | sí ¹² | parcial ¹³ | sí | parcial ¹⁴ | — |
| IA-12 un código, un significado | no ¹⁵ | sí | sí | sí | sí | sí | sí | — |
| IA-13 selección múltiple | sí | — | — | — | — | — | — | — |
| IA-15 filas-tarjeta, grupos con divisor | sí | sí | sí | sí | sí ¹⁶ | sí | sí | sí |

1. Tres botones de exportar dentro del contenido; con selección se mudan al "…".
2. Pestañas dentro de `children`, no en `toolbar`; la pestaña no está en la URL.
3. El vacío total no tiene `description`; los vacíos de pestaña son un `<p>`.
4. `ToBuyGroup` usa `text-sm font-medium` (igual que una fila); `BoughtGroup`, mayúsculas chicas.
5. `h3 text-sm font-medium`: correcto como rótulo pero distinto del de Hitos/Compras.
6. En "Comprados" la fila repite el estado del grupo con el badge.
7. Línea 2 en `text-sm`; unidad en singular ("107 Unidad").
8. `MilestoneCard` es tarjeta, no fila: metadatos arriba del título como antetítulo. Aceptable para tarjetas; no copiar a filas.
9. El lápiz sólo en Pendiente corre la columna de estado y duplica "Editar" del menú.
10. El badge de la cuota va en la línea 1, pegado al concepto.
11. Visible: "Contratación" en la obra, "Obras" en la libreta de la Empresa. Tareas, Materiales y Editar en "…"; "Sacar de la obra" y "Dar de baja", en "…" y confirmados. Antes: hasta cinco íconos por fila y "Sacar de la obra" al toque.
12. Gastos: visible "Comprobante" (si hay); eliminar en "…" y confirmado. Cobros: cuotas y cobros sólo con "…"; el borrado confirma y explica que un cobro no se edita. Antes: tacho visible que borraba al toque.
13. Descargar y borrar visibles; el borrado sí confirma.
14. `Select` de rol inline + tacho visible; el tacho sí confirma.
15. "Solicitado" y "Empieza en N días": mismo tono `warning` y mismo glifo `Clock`.
16. Documentos es una grilla de miniaturas, no una lista: cada documento ya es su tarjeta; los grupos sí van con `ListSection`.

Empleados de la Empresa (`StaffList` en `organization-panel.tsx` y
`CrewList`) cumple IA-11: visible "Obras" para el personal de obra y, para el
administrativo, "Reenviar invitación" si no activó la cuenta o "Dar acceso a
obras" si ya la activó; Editar y la baja en "…", la baja confirmada. Antes:
tres o cuatro íconos por fila.

No revisado en detalle: el Tablero (`TaskBoard`), el Gantt del Cronograma por
dentro, Presupuesto y el Resumen de la obra (`project-detail.tsx`, sólo se
miró que usa pestañas con conteo dentro de una Card).

### Inconsistencias de documentación encontradas

- `EmptyState` (comentario de `action`) dice que la acción principal va
  "arriba a la derecha"; `PageLayout` la pone abajo a la derecha, flotando.
  Manda `PageLayout`.
- `project-payments.tsx` comenta que "las dos altas van arriba, siempre"; la
  primaria flota abajo.
- `CLAUDE.md` y `DESIGN.md` nombran `PageHeader`; el componente es
  `HeaderTitle`, en `components/dashboard/navigation/page-header.tsx`.
