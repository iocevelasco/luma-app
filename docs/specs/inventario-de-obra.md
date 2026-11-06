# Inventario de obra y Kardex

**Estado:** Fase 1 implementada · Fase 2 (Depósito General) pendiente · **Fecha:** 2026-11-06 · **Pantalla:** `/admin/proyectos/:projectId/inventario`

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
  su movimiento `compra` (único por material). Se genera al leer
  (`ensurePurchaseEntries`), así cubre también lo que ya estaba en obra y se
  repara solo si falla. Si el material vuelve a un estado anterior, la entrada
  queda: el kardex es historia, no un espejo de Compras.
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

## Fuera de esta fase

- **Depósito General** (desincorporar a la Empresa, importar a una obra nueva a
  costo $0, flete como gasto, "Ahorro por reutilización"). Pide ubicación en
  `StockMovement` (obra o Empresa) y decidir cómo se congela el costo de
  referencia (moneda y cotización).
- **Costos por movimiento** ("imputa el costo real a esa etapa").
- **Foto de remisión** adjunta al movimiento.
- **Exportar el kardex a PDF/Excel.**
- **Tiempo real por SSE**: hoy el inventario no usa el hub; se vuelve a pedir
  al abrir la pantalla (`staleTime: 0`).

## Límite conocido

Validar el stock y escribir la salida no es atómico: dos despachos simultáneos
del mismo material podrían dejar el stock apenas en negativo. Con el volumen de
una obra es improbable; si molesta, se resuelve con una transacción.

## Notas de la revisión

- **La fecha del movimiento la pone el servidor.** El cliente no manda
  `occurredAt`: una fecha elegida permitiría meter un movimiento en un período
  ya cerrado.
- **Leer escribe.** `ensurePurchaseEntries` inserta, en un GET, la entrada de
  cada material que ya llegó a obra. Es un hecho que ya ocurrió y lo escribe el
  sistema, también con la suscripción vencida (sólo lectura para quien opera).
- **Pendiente:** el filtro de fechas del kardex corta en UTC (un movimiento de
  la noche cae al día siguiente en UTC−4); el kardex tope de 1000 filas no avisa
  que se acotó; una devolución no tiene techo (corrige un consumo, pero puede
  inflar el stock).
