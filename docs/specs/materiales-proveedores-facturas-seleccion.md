# Compras: proveedor vinculado, selección múltiple y facturas

**Estado:** Fase 1 implementada · preguntas bloqueantes cerradas (1 y 3, 2026-10-22) · **Fecha:** 2026-10-22 · **Pantalla:** `/app/admin/proyectos/:projectId/materiales` (Compras)

## Resumen

Tres pedidos del cliente sobre Compras, en el orden en que conviene construirlos:

1. **Selección múltiple** ("como en Gmail"): tildar varios materiales, o todos, y
   aplicarles una acción de una vez.
2. **Proveedor vinculado**: que el proveedor de un material se elija del
   directorio de Proveedores de la obra en vez de escribirse a mano.
3. **Cargar facturas**: adjuntar la factura de una compra a los materiales que
   cubre.

No hace falta un modelo nuevo. La selección es sólo pantalla + un endpoint en
lote; el proveedor es un campo `provider` en `MaterialItem` que apunta a
`Provider`; la factura es un `Expense` (que ya tiene `receipt`, categoría y
proveedor) con la lista de materiales que paga.

Esta spec revierte dos no-objetivos de
[materiales-editar-eliminar-pdf.md](materiales-editar-eliminar-pdf.md):
"vincular `supplier` al directorio" y "selección múltiple". Los dos se habían
dejado afuera hasta que alguien los pidiera; ya los pidieron.

---

## Problema

El feedback, textual:

> "Los proveedores que cargamos en la sección [Proveedores] ¿pueden vincularse a
> los proveedores que me pide la sección de materiales? Para que el proveedor
> sean autorizados y planificados."
>
> "En la sección de compras ¿podemos agregar una sección de cargar facturas?"
>
> "¿Es posible hacer, como en Gmail, marcar todos los ítems?"

Lo que se ve en las capturas y en el código:

- **El proveedor del material es texto libre** (`MaterialItem.supplier`). La
  persona escribe "800 Aluminio" aunque ese proveedor ya exista en Proveedores
  con teléfono y especialidad. Dos fuentes que no se hablan: un typo crea un
  proveedor fantasma, y desde Proveedores no se puede saber qué materiales le
  tocan a cada uno.
- **Todo se hace de a uno.** Una lista de 10 pendientes son 10 "Marcar
  solicitado" y 10 confirmaciones. Cuando se encarga todo a un mismo proveedor
  —el caso común al salir a comprar— es el paso que más se repite.
- **La factura no tiene dónde ir.** Hoy se puede cargar como comprobante de un
  gasto en Finanzas, pero Compras no la conoce: no hay forma de ver qué
  materiales ya tienen factura ni de cargarla desde donde se registró la compra.

## Objetivos

1. Pasar *N* materiales de Pendiente a Solicitado en una sola acción: ≤ 3 toques
   para cualquier *N*.
2. Que ≥ 80 % de los materiales nuevos con proveedor lo tengan **vinculado** al
   directorio, no escrito a mano, a 30 días del lanzamiento.
3. Que desde Proveedores se pueda contestar "¿qué materiales le compramos a este
   proveedor en esta obra?" sin salir de su ficha.
4. Que una factura cargada en Compras sea **el mismo gasto** que ve Finanzas, y
   no una segunda copia de la misma plata.
5. Que el cliente siga sin poder ver una factura ni un monto gastado.

## No-objetivos

| Fuera de alcance | Por qué |
|---|---|
| Leer la factura automáticamente (OCR, montos, CUIT) | Problema distinto y caro; primero hay que validar que la gente las carga. |
| Un modelo `Invoice` aparte de `Expense` | Una factura de materiales **es** un gasto con comprobante. Dos modelos para la misma plata rompen la tabla de cifras de CLAUDE.md. |
| Órdenes de compra / mandar el pedido al proveedor desde la app | Es otro flujo (envío, confirmación del proveedor). El PDF por proveedor cubre el 80 %. |
| Migrar automáticamente el texto viejo a proveedores del directorio | Un match por nombre falla en silencio ("JDR" vs "JDR Ferretería"). Se ofrece vincular a mano. |
| Selección múltiple en "Comprados" para borrar | Lo comprado es registro; no se borra ni de a uno. |

## Personas y permisos

Nada de esto agrega roles; agrega a lo sumo celdas en
`packages/shared/src/permissions/index.ts`.

| Rol | Hoy en Compras | Con esta spec |
|---|---|---|
| Gerente | `material.write`, `expense.write`, `provider.*` | Todo |
| Supervisor | `material.write`, `provider.read`, **sin** `expense.*` | Selección múltiple, proveedor vinculado y **carga facturas** con una capacidad acotada (R3.6), sin `expense.*` |
| Contador | `expense.*`, **sin** `material.read` | Ve las facturas desde Finanzas, como hoy |
| Cliente | Sin `material.read` | Nada cambia. Nunca ve una factura |

---

## Historias de usuario

**Supervisor en la obra**
- Como supervisor, quiero tildar todos los pendientes que le pido a un mismo
  proveedor y marcarlos solicitados de una vez, para no repetir la misma acción
  diez veces desde el celular.
- Como supervisor, quiero elegir el proveedor de un material de la lista de
  proveedores de la obra, para no tener que acordarme cómo se escribe ni crear
  un duplicado.
- Como supervisor, si el proveedor no está cargado, quiero poder escribirlo igual,
  para no frenar la carga del material por un trámite de alta.

**Gerente**
- Como gerente, quiero bajar la lista de compras separada por proveedor, para
  mandarle a cada uno sólo lo suyo.
- Como gerente, quiero cargar la factura de una compra y marcar qué materiales
  cubre, para que la compra quede documentada y el gasto aparezca en Finanzas
  sin cargarlo dos veces.
- Como gerente, quiero ver en un material si ya tiene factura, para saber qué
  me falta reclamar.
- Como gerente, quiero ver en la ficha de un proveedor los materiales que se le
  asignaron en esta obra.

**Bordes**
- Si tildo materiales en distintos estados, sólo quiero ver las acciones que
  valen para todos (por ejemplo, "Eliminar" sólo si todos están Pendiente).
- Si la acción en lote falla para alguno, quiero saber cuáles y que no quede la
  mitad aplicada.
- Si el proveedor vinculado se da de baja, el material tiene que seguir diciendo
  a quién se le compró.

---

## Requisitos

### Fase 1 — Selección múltiple (P0)

Sin cambios de modelo.

**R1.1 — Casilla por fila y "seleccionar todos".**
- Cada fila tiene una casilla a la izquierda, como objetivo propio (≥ 44 px). La
  fila **no** se vuelve tocable entera: es la objeción de la spec anterior
  (guantes, celular) y la casilla la resuelve.
- Arriba de la lista, una casilla maestra con tres estados (ninguno / algunos /
  todos). Selecciona todo lo **visible en la pestaña actual**, incluidos los
  grupos por tarea.
- Cada grupo por tarea ("Sin tarea asociada", etc.) tiene su propia casilla de
  grupo.
- Cambiar de pestaña limpia la selección.

**R1.2 — Barra de acciones.**
Con ≥ 1 seleccionado, la barra de *Descargar PDF / Copiar lista / Compartir* se
reemplaza por: contador ("3 seleccionados"), acciones y "Cancelar". En móvil va
fija abajo, encima del FAB (que se oculta mientras haya selección).

| Acción | Cuándo aparece |
|---|---|
| Avanzar estado ("Marcar solicitado", "Marcar comprado"…) | Todos los seleccionados en el **mismo** estado |
| Cambiar estado a… | Siempre |
| Asignar proveedor | Siempre (Fase 2) |
| Descargar PDF / Copiar / Compartir sólo lo seleccionado | Siempre |
| Eliminar | Todos `editable` (nunca salieron de Pendiente) |
| Cargar factura | Fase 3, ver R3 |

**R1.3 — Endpoint en lote, atómico.**
`PATCH /api/projects/:projectId/materials/bulk` con `{ ids, status }` y
`POST …/materials/bulk/delete` con `{ ids }`, ambos `requireCapability('material.write')`.
El borrado es un POST porque un DELETE con body se pierde en algunos proxies.
En Fase 1 el lote cambia sólo el estado; "asignar proveedor" lo amplía en Fase 2.
- Todos los `ids` tienen que ser de la obra. Si uno no lo es, 404 para todos.
- Si uno viola una regla (borrar uno no editable), **no se aplica ninguno**: 409
  con `details.ids` de los que fallaron. Sin aplicación parcial.
- Tope de 200 ids por llamada.
- Schemas Zod en `@luma/shared`.

**R1.4 — Confirmación.**
Las acciones de estado y borrado confirman con la cantidad ("¿Marcar 7
materiales como solicitados? Después no se pueden editar."). El aviso de
bloqueo que ya existe para uno vale para varios.

Criterios de aceptación:
- [ ] Con 10 pendientes, tildar la maestra + "Marcar solicitado" + confirmar deja
      los 10 en Solicitado y pasan a la pestaña correspondiente.
- [ ] Con uno Pendiente y uno Solicitado tildados, "Eliminar" no aparece.
- [ ] Un `DELETE /bulk` con un id no editable devuelve 409 y no borra ninguno.
- [ ] La casilla maestra muestra el estado intermedio si hay algunos tildados.
- [ ] Teclado: espacio tilda la fila enfocada; la barra anuncia el conteo
      (`aria-live`).
- [ ] E2E del flujo "tildar todos → marcar solicitado".

### Fase 2 — Proveedor vinculado (P0)

**R2.1 — Campo nuevo, el viejo se queda.**
`MaterialItem.provider?: ObjectId → Provider`, opcional. `supplier` (texto)
**se mantiene** como alternativa para proveedores que no están en el directorio
y para los datos existentes. Si hay `provider`, la UI muestra su nombre y
`supplier` se ignora.

**R2.2 — Selector en el drawer.**
Es lo que el cliente pidió con "autorizados y planificados" (pregunta 3,
cerrada): cargo un proveedor que vende madera en Proveedores, y al crear un
material lo elijo de esa lista en vez de escribirlo. "Autorizado" = está en el
directorio de la obra; no hay filtro por contratación aprobada.

El campo "Proveedor (opcional)" pasa a ser un combobox con búsqueda:
- Opciones: los proveedores que **ve la obra** — los de la Empresa con fila en
  `ProjectProvider` más los de alcance `project` de esa obra, activos. Todos,
  tengan o no contratación (`ProviderEngagement`): a un corralón no se lo
  contrata, se le compra.
- Si lo escrito no coincide con ninguno, la última opción es "Usar «800
  Aluminio» sin vincular", que guarda texto como hoy.
- Si la persona tiene `provider.manage`, una opción "Agregar a Proveedores…" abre
  el alta con el nombre ya escrito. **Ver pregunta 2.**

**R2.3 — Validación en la API.** Un `provider` que la obra no ve → 422. Nunca se
acepta un proveedor de otra Empresa.

**R2.4 — Baja del proveedor.** `Provider` tiene baja lógica: el material lo sigue
mostrando con su nombre y una marca "dado de baja". No se lo puede elegir en
materiales nuevos.

**R2.5 — Materiales viejos.** Un material con sólo `supplier` muestra un aviso
discreto "Sin vincular" y, si existe un proveedor de la obra con el **mismo
nombre exacto** (sin mayúsculas ni espacios), sugiere vincularlo con un toque.
Nada se vincula solo.

**R2.6 — Desde Proveedores.** La ficha del proveedor dentro de la obra muestra
sus materiales, agrupados por estado, con link a Compras. Lectura con
`material.read` (el cliente no la ve aunque tenga `provider.read`).

Criterios de aceptación:
- [ ] Al editar "Perfil 3/4 blanco corte 1.2", escribir "800" ofrece "800
      Aluminio" del directorio; al elegirlo queda vinculado.
- [ ] Un proveedor de la Empresa que no fue agregado a esta obra no aparece.
- [ ] Un `PATCH` con un `provider` de otra obra devuelve 422 con `code`.
- [ ] Dar de baja el proveedor no borra ni cambia el nombre en sus materiales.
- [ ] "Copiar lista", "Compartir" y PDF usan el nombre del proveedor vinculado.

**P1 dentro de Fase 2:**
- **PDF y "Copiar" agrupados por proveedor** (una sección por proveedor, los sin
  proveedor al final). Era un no-objetivo de la spec anterior; con el vínculo es
  barato.
- **Asignar proveedor en lote** desde la barra de R1.2.

### Fase 3 — Facturas (P0 de la fase, depende de 1 y 2)

**R3.1 — Una factura es un gasto.**
"Cargar factura" crea un `Expense` con `category: 'material'`, `receipt` (el
archivo), monto, moneda, cotización, fecha y `provider`. Se agrega a `Expense`
un campo `materials: ObjectId[]` con los materiales que cubre. No hay modelo
`Invoice`.

Consecuencias que hay que respetar:
- La factura aparece en Finanzas como cualquier gasto, y el gasto que se carga
  en Finanzas puede asociarse a materiales. **Una sola carga**, dos lugares
  donde se ve.
- Moneda y cotización congeladas, como todo movimiento (regla 2 de Plata).
- Rutas con `expense.*` o con las capacidades de factura de R3.6. Nunca con
  `material.*` ni `payment.*` (regla 3).
- El comentario de `MaterialItem.ts` ("nada lo referencia") deja de ser cierto.
  El borrado duro sigue siendo seguro porque sólo se borra un material Pendiente,
  y uno Pendiente no puede tener factura (R3.3). Hay que actualizar el comentario.

**R3.2 — Entrada.**
- Desde la barra de selección (R1.2): tildar materiales → "Cargar factura". El
  formulario llega con el proveedor precargado si todos comparten uno.
- Desde el menú "…" de un material.
- Archivo: PDF o imagen, mismo storage y límites que los comprobantes de hoy. En
  móvil, la opción de sacar foto.

**R3.3 — Estado.** Sólo se asocia factura a materiales **Comprado** o **En obra**.
Si se tildan Solicitados, el formulario ofrece "Marcarlos como comprados al
guardar". Un material Pendiente nunca tiene factura.

**R3.4 — Lectura en Compras.** Cada material con factura muestra un ícono de
comprobante (Lucide `ReceiptText`); tocarlo abre el archivo con URL firmada. Lo ve
quien tiene `expense.read` o `material.invoice.read`.

**R3.5 — Errores.** Falla al guardar → banner en el formulario (`FormShell`),
nunca toast. Éxito → toast.

**R3.6 — El supervisor carga facturas (pregunta 1, cerrada: sí).**
Dárselo con `expense.write` le abriría todo Finanzas: nómina, otros gastos y el
resumen. En cambio, dos celdas nuevas en la grilla:

| Capacidad | Gerente | Supervisor | Contador | Cliente |
|---|---|---|---|---|
| `material.invoice.write` | ✓ | ✓ | — | — |
| `material.invoice.read` | ✓ | ✓ | — | — |

- Rutas propias bajo materiales: `POST /materials/invoices` (crea el `Expense`
  con `category: 'material'` forzada y `materials` obligatorio, ≥ 1),
  `GET /materials/:id/invoices`, `DELETE /materials/invoices/:expenseId`.
- Con `material.invoice.*` sólo se alcanzan gastos de categoría `material` con
  `materials` no vacío. Un gasto de nómina o de herramienta nunca sale por ahí.
- El supervisor ve monto y archivo de las facturas de materiales, nunca el
  resumen ni el total gastado. No tiene `payment.read`, así que tampoco puede
  calcular el margen.
- **Corregir**: el supervisor no edita; borra **la que cargó él** y la vuelve a
  cargar. Gerente y contador corrigen cualquiera desde Finanzas (`expense.write`).
- El contador no gana nada nuevo: ya ve estas facturas en Finanzas, que es donde
  trabaja.

Criterios de aceptación:
- [ ] Tildar 4 comprados de "800 Aluminio" → Cargar factura → adjuntar PDF y
      monto → el gasto aparece una sola vez en Finanzas con los 4 materiales.
- [ ] El total gastado de la obra sube exactamente el monto de la factura.
- [ ] Un usuario cliente no puede obtener la factura ni por la UI ni con `curl`
      a ninguna ruta de materiales.
- [ ] Borrar el gasto en Finanzas quita el ícono de los materiales.
- [ ] Asociar una factura a un Pendiente devuelve 409.
- [ ] Un supervisor carga una factura desde Compras; el gerente la ve en Finanzas.
- [ ] Un supervisor no puede llamar `GET /finance/expenses` ni `/finance/summary`
      (403), ni borrar una factura que cargó otra persona (403).
- [ ] `POST /materials/invoices` con `category` distinta de `material` o sin
      materiales devuelve 422.

### Consideraciones futuras (P2)

- Una factura que cubre materiales **y** mano de obra (dividir el gasto).
- Comparar el costo estimado de los materiales con lo facturado.
- Recordatorio "materiales comprados sin factura hace más de 7 días".

---

## Métricas de éxito

| Métrica | Tipo | Meta (éxito / stretch) | Cómo se mide |
|---|---|---|---|
| Cambios de estado hechos en lote / total | Leading | 40 % / 60 % a 30 días | `statusChangedAt` agrupado por request en logs del endpoint bulk |
| Materiales nuevos con `provider` vinculado / con algún proveedor | Leading | 80 % / 95 % a 30 días | Consulta sobre `MaterialItem` creados post-lanzamiento |
| Materiales Comprados con factura asociada | Lagging | 50 % / 75 % a 60 días | `Expense.materials` vs `MaterialItem` en Comprado/En obra |
| Gastos de materiales duplicados (misma factura cargada dos veces) | Lagging | 0 reportes | Feedback / soporte |

## Preguntas abiertas

| # | Pregunta | Quién | ¿Bloquea? |
|---|---|---|---|
| 1 | ~~¿El supervisor carga facturas?~~ **Cerrada: sí**, con `material.invoice.*` y sin `expense.*` (R3.6). | Stakeholder | — |
| 2 | **¿Quién da de alta un proveedor desde Compras?** El supervisor tiene `provider.read`/`assign`, no `manage`. Si no puede, escribe el nombre suelto (R2.2) y el gerente lo vincula. Recomendación: así, sin permiso nuevo. | Stakeholder | No |
| 3 | ~~¿Qué es "autorizados y planificados"?~~ **Cerrada**: elegir el proveedor del material de la lista de Proveedores, sin filtro por contratación (R2.2). | Cliente | — |
| 6 | ~~¿Agregamos una especialidad para quien vende materiales?~~ **Cerrada: sí**, `materiales` ("Venta de materiales"), sólo en proveedores. Actividades y personal siguen con `TradeSpecialty`. | Stakeholder | — |
| 4 | Una factura que cubre materiales de **dos obras**: ¿se parte en dos gastos o queda fuera de v1? Recomendación: fuera; se cargan dos. | Stakeholder | No |
| 5 | ¿El monto de la factura es obligatorio? En `Expense` lo es. Si la gente sólo quiere guardar el papel, la pregunta 1(b) vuelve. | Stakeholder | No |

## Fases y dependencias

| Fase | Qué | Cambia modelo | Depende de |
|---|---|---|---|
| 1 | Selección múltiple + endpoints bulk | No | — |
| 2 | `MaterialItem.provider` + selector + vista desde Proveedores | Sí (campo) | — |
| 2.1 | PDF/copiar por proveedor, asignar en lote | No | 1 y 2 |
| 3 | Facturas como `Expense.materials` | Sí (campo) | 1 y 2 |

Las fases 1 y 2 no se tocan entre sí y pueden ir en paralelo. Cada fase sube la
versión de `packages/web` (`pnpm bump:web minor`) y agrega sus claves de i18n
en `es` y `pt` a la vez.
