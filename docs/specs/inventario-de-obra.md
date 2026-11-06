# Inventario de obra y Kardex

**Estado:** Fases 1 y 2 implementadas · **Fecha:** 2026-11-06 · **Pantallas:** `/admin/proyectos/:projectId/inventario` y `/admin/deposito`

## Qué resuelve

Compras (`MaterialItem`) dice qué se pidió y qué llegó a obra. No dice cuánto
queda en el patio, quién se llevó qué ni cuánto se perdió. El inventario es
esa cuenta corriente.

## Decisiones (cerradas 2026-11-06)

- **Un modelo nuevo, `StockMovement`**: el kardex. Inmutable: no hay endpoint
  que edite ni borre; una corrección es otro movimiento (una devolución). Se va
  sólo con la obra (`PROJECT_OWNED`).
- **El stock no se guarda.** Se recalcula sumando el kardex
  (`summarizeStock`, `@luma/shared`). Mismo criterio que la plata de obra.
- **El material no es una entidad.** Se identifica por `itemKey`: nombre
  normalizado + unidad (`stockItemKey`). Sin catálogo.
- **La entrada por compra es automática**: cada `MaterialItem` en `en_obra` tiene
  su movimiento `compra` (único por material). Se escribe **al pasar a «En
  obra»** (`recordPurchaseEntries`, desde el controller de Compras) y es
  idempotente: reintentar el cambio completa una entrada que falló. Las lecturas
  del inventario no escriben. Lo que ya estaba en obra antes se cubre una vez con
  `backfill-stock-entries` (ver `docs/DEPLOY.md`). Si el material vuelve a un
  estado anterior, la entrada queda: el kardex es historia, no un espejo de
  Compras.
- **Permisos**: `inventory.read` lo tienen gerente, supervisor, arquitecto,
  ingeniero y diseñador; `inventory.write` sólo gerente y supervisor (excepción
  explícita a "los profesionales hacen todo lo del supervisor"). Contador y
  cliente no lo ven, ni con Compras abierta al cliente.
- **Alerta de stock bajo**: regla, no campo. Por agotarse = queda ≤ 20 % de lo
  que entró (`LOW_STOCK_RATIO`).

## Movimientos

| Tipo | Efecto | Pide |
|---|---|---|
| `compra` | suma | (automático) |
| `devolucion` | suma | — |
| `consumo` | resta | quién lo recibe |
| `merma` | resta | motivo y responsable |

Una salida que dejaría el stock en negativo responde `409`.

## Fase 2: Depósito General

El material sobrante viaja entre obras de la misma Empresa.

- **Un traspaso son dos filas** de `StockMovement` unidas por `transfer`: la de
  la obra (`desincorporacion` / `importacion`) y la del Depósito
  (`deposito_ingreso` / `deposito_egreso`), **sin `project`** y con
  `organization`. Así el stock del Depósito no se va cuando se purga la obra que
  lo mandó. No hay transacciones: si falla la segunda escritura se borra la
  primera, que es del mismo request.
- **Costo de referencia**: se escribe al desincorporar (la pantalla lo sugiere
  con el costo estimado de la compra ÷ su cantidad) y se congela, con su
  moneda y su cotización, en la fila del Depósito. Es un **promedio móvil**: lo
  que sale se lleva su parte al costo promedio de ese momento, así el costo
  unitario es el de lo que queda y cada egreso congela ese promedio. Una línea
  del Depósito es material **por moneda**: no se promedian monedas.
- **Importar es costo $0**: sin factura, sin proveedor, sin cuenta por pagar. El
  flete opcional es un `Expense` (categoría «otro») de la obra destino, en su
  moneda, con cotización 1; pide además `expense.write`.
- **Ahorro por reutilización**: cantidad × costo congelado de cada egreso, por
  obra destino y moneda. Nunca se suma entre monedas ni entre unidades
  (`summarizeSavings`). Se ve sólo en la pantalla del Depósito.
- **Permisos**: `inventory.deposit.write` es del **dueño de la obra**
  (`OWNER_ONLY`): el Depósito es de la Empresa y otro gerente puede ser de otra.
  La pantalla del Depósito (`GET /api/organizations/me/deposit`) es de los
  dueños de la Empresa.
- **Cotización**: el costo de referencia va en la moneda de la obra de origen y
  nunca se convierte, así que la cotización congelada en cada fila del Depósito
  (`exchangeRate`) es siempre 1; está para que la regla de Plata valga sin
  excepciones el día que haya que convertir.
- **Ahorro neto**: si la obra destino devuelve al Depósito lo que importó, el
  ahorro de esa parte se revierte (al costo con que se contó, sin pasarse de lo
  que importó; sólo si la devolución va en la misma moneda).

## Fuera de esta fase

- **Costos por movimiento** ("imputa el costo real a esa etapa").
- **Flete en otra moneda** que la de la obra destino: se carga a mano en Gastos.
- **Foto de remisión** adjunta al movimiento.
- **Exportar el kardex a PDF/Excel.**
- **Tiempo real por SSE**: hoy el inventario no usa el hub; se vuelve a pedir
  al abrir la pantalla (`staleTime: 0`).

## Límites conocidos de la Fase 2

- **Dos importaciones simultáneas** de la misma línea del Depósito podrían dejarla
  apenas en negativo (la validación y la escritura no son atómicas, igual que en
  el patio).
- **Un traspaso son dos escrituras sin transacción.** Si una falla se deshace la
  otra, y si el deshacer también falla el error que sube es el original. Si el
  proceso muere entre las dos, `repair-incomplete-transfers` (tarea diaria, ver
  `docs/DEPLOY.md`) revierte los traspasos con una mitad faltante de hace entre
  10 minutos y 3 días: el límite de 3 días evita confundirlos con las filas que
  borra la purga de una obra.
- **Leer el Depósito escanea todo su kardex**: las líneas y el ahorro dependen de
  un promedio móvil, que necesita todas las filas. Se lee sin hidratar y sólo con
  los campos que se suman; el historial sí se ordena y acota en la base. Si pesa,
  el paso siguiente es guardar un resumen.
- **El flete no queda atado al traspaso**: es un gasto común de la obra
  destino (categoría «otro»); no se descuenta solo del ahorro.
- **El ahorro cuenta materiales distintos** (`items`), no unidades: una bolsa y
  un metro no se suman. El monto es la suma de cantidad × costo congelado.
- **Obra purgada**: el Depósito conserva su stock; el historial y el ahorro
  muestran «Obra eliminada» en vez del nombre.
- **El menú «Depósito» lo ve todo usuario del panel**, como Proveedores y
  Empleados; quien no es dueño de una Empresa ve una explicación en vez del
  Depósito.
- **`spentOn` del flete** usa la fecha del servidor, no la del usuario.

## Límite conocido

Validar el stock y escribir la salida no es atómico: dos despachos simultáneos
del mismo material podrían dejar el stock apenas en negativo. Con el volumen de
una obra es improbable; si molesta, se resuelve con una transacción.

## Notas de la revisión

- **La fecha del movimiento la pone el servidor.** El cliente no manda
  `occurredAt`: una fecha elegida permitiría meter un movimiento en un período
  ya cerrado.
- **Pendiente:** el filtro de fechas del kardex corta en UTC (un movimiento de
  la noche cae al día siguiente en UTC−4); el kardex tope de 1000 filas no avisa
  que se acotó; una devolución no tiene techo (corrige un consumo, pero puede
  inflar el stock).
