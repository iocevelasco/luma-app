# Especialidades: arquitectura, diseño, drywall y propias de la obra · Métodos de pago

**Estado:** borrador · **Fecha:** 2026-11-03 · **Origen:** feedback del cliente
**Pantallas:** Cronograma → "Nueva tarea", Proveedores → "Nuevo proveedor", Personal, Cobros y Gastos

## Resumen

Cuatro pedidos del cliente que tocan **dos catálogos que ya existen**. No hay
entidades de negocio nuevas salvo una decisión abierta (ver Preguntas abiertas #1).

1. **Catálogo de especialidades** (`TradeSpecialty`): sumar `arquitectura`,
   `diseño` y `drywall`.
2. **Especialidades propias de la obra**: el gerente agrega las suyas además de
   las de base.
3. **Selector con búsqueda**: cuando la lista pasa de 15 ítems, el selector
   muestra un buscador con sugerencias.
4. **Métodos de pago** (`PaymentMethod`): sumar Zelle, Binance, transferencia en
   euros / bolívares / dólares y pago móvil — en cobros **y gastos**.

---

## Problema

- **El catálogo se queda corto y no se puede ampliar.** Las 19 especialidades
  actuales no incluyen arquitectura, diseño ni drywall. Cada obra tiene rubros
  distintos; hoy quien no encuentra el suyo elige `otra` y pierde el filtro y el
  agrupado (en proveedores `otra` exige texto libre; en tareas no hay salida).
- **El selector no escala.** Es un desplegable plano de 19 ítems que ya obliga a
  scrollear (captura de "Nuevo proveedor"). Con rubros propios crecería sin techo.
- **Los métodos de pago no reflejan cómo se paga en Venezuela.** Hoy son
  `transferencia | efectivo | cheque | otro`. Zelle, Binance y pago móvil son
  los medios más usados y caen todos en "otro", y "transferencia" no dice en qué
  moneda salió la plata. **Los gastos ni siquiera registran método** (el modelo
  `Expense` no tiene el campo): hoy no hay dónde anotarlo.

## Objetivos

1. Que el gerente encuentre su especialidad en menos de 5 segundos escribiendo 2–3
   letras, sin scrollear.
2. Que cualquier especialidad que el gerente necesite exista (de base o propia)
   sin pasar por `otra`.
3. Que el 100% de los cobros y gastos nuevos registren un método específico, y
   que "otro" deje de ser el método dominante.
4. Cero migración manual: lo cargado hoy sigue siendo válido y se lee igual.

## No-objetivos

- **Reconvertir plata por método.** El método es un dato del movimiento; la
  moneda y la cotización siguen siendo campos propios, congelados (CLAUDE.md,
  Plata, regla 2). "Transferencia en euros" **no** reemplaza a `currency`.
- **Catálogo global editable por el cliente.** La base la mantiene Luma; las
  propias son por obra.
- **Cambiar la libreta de proveedores de la Empresa** (`OWNER_ONLY`). Un
  proveedor sigue usando especialidades; no se rediseña ese flujo.
- **Métodos de pago de la suscripción** (`SubscriptionPaymentMethod`). Es otra
  cosa y no se cruza con los cobros de obra.
- **Integraciones** (Binance, Zelle, bancos): sólo se etiqueta el método.

---

## Historias de usuario

**Gerente**
- Como gerente, quiero **agregar una especialidad propia a mi obra** para poder
  clasificar tareas y proveedores con el rubro real que uso.
- Como gerente, quiero **buscar escribiendo** en el selector de especialidad para
  no recorrer una lista larga.
- Como gerente, quiero **crear la especialidad desde el mismo selector** cuando
  la búsqueda no encuentra nada, para no salir del formulario.
- Como gerente, quiero **renombrar o quitar** una especialidad propia que ya no
  uso, para que la lista no se ensucie.

**Supervisor / contador**
- Como supervisor, quiero **elegir especialidades propias de la obra** al crear
  una tarea, aunque no pueda crearlas.
- Como contador, quiero **registrar Zelle, Binance, pago móvil o la moneda de la
  transferencia** en cobros y gastos para conciliar contra el extracto correcto.

**Cliente**
- Como cliente, quiero ver **con qué medio** se registró cada cobro sin ver
  nada de los gastos (regla de rutas separadas).

---

## Requisitos

### P0 — sin esto no sale

**R1. Tres especialidades de base nuevas**
`arquitectura`, `diseno` (valor de código sin ñ), `drywall`. Etiquetas:
"Arquitectura", "Diseño", "Drywall". Valores de código en inglés o sin tildes
según la convención del repo.
- [ ] Aparecen en Tarea, Personal y Proveedor (comparten `TradeSpecialty`).
- [ ] Las tareas, proveedores y personal ya cargados siguen mostrándose igual.
- [ ] Hay clave i18n en `es`, `es-ES` y `pt` (test de paridad).

**R2. Selector con búsqueda y sugerencias**
Componente único de selector (sobre `command` + `popover`, que ya están en
`components/ui`) usado en todos los formularios que piden especialidad.
- [ ] Con **≤ 15** ítems se muestra la lista plana actual, sin buscador.
- [ ] Con **> 15** ítems se muestra un campo de búsqueda arriba y la lista
      filtra mientras se escribe, ignorando tildes y mayúsculas ("diseno" encuentra
      "Diseño").
- [ ] Las **sugerencias** son las especialidades más usadas en esa obra, primero.
- [ ] Sin resultados: mensaje claro y, si la persona puede crear, el botón
      "Crear «texto»" (ver R4).
- [ ] Teclado completo (flechas, Enter, Esc) y funciona en Safari/iOS; sin
      `100vh`, sin APIs sin fallback.
- [ ] Hoy son 22 ítems (19 + 3), así que el buscador aparece desde el primer día.

**R3. Especialidades propias por obra**
El gerente define especialidades adicionales para **su obra**.
- [ ] Tope de 5 gerentes y reglas de dueño sin cambios; crear/editar/quitar se
      agrega a la grilla como **una celda nueva** (ver pregunta #2).
- [ ] Nombre obligatorio, único en la obra sin distinguir mayúsculas ni tildes,
      y que no repita una de base.
- [ ] Una propia se **guarda con el id de la obra**; no es visible en otras obras.
- [ ] Si se quita una que está en uso, **no se borra la tarea ni se pierde el
      dato**: la especialidad queda como "archivada", visible en lo ya cargado y
      oculta en el selector.
- [ ] Obra con suscripción vencida: sólo lectura, sin tocar nada extra
      (`requireProjectAccess` ya recorta las capacidades).

**R4. Crear desde el selector**
- [ ] "Crear «texto»" aparece sólo para quien tiene la capacidad.
- [ ] Al crear, queda **seleccionada** y el formulario no pierde lo ya tipeado.
- [ ] Falla al crear: banner en el formulario, no toast (CLAUDE.md, Errores en la UI).

**R5. Métodos de pago nuevos en cobros y gastos**
Agregar a `PaymentMethod` (shared → schema Zod → enum de Mongoose):
`zelle`, `binance`, `transferencia_eur`, `transferencia_ves`, `transferencia_usd`,
`pago_movil`.
- [ ] Quedan: efectivo, cheque, otro, **y** los seis nuevos.
- [ ] `transferencia` genérica se **conserva** para no romper cobros existentes
      y sale del selector en lo nuevo (ver pregunta #3).
- [ ] **Gastos**: `Expense` gana un campo `method` **opcional**; los gastos
      anteriores quedan sin método y la UI no lo exige hacia atrás.
- [ ] El método no altera `currency`, la cotización ni los totales.
- [ ] El cliente ve el método del **cobro** y nunca nada de `expense.*`.

### P1 — fast follow

- **R6.** Filtro por método en la lista de cobros y gastos.
- **R7.** Sugerir el método según el último usado en la obra.
- **R8.** Ordenar las sugerencias del selector por uso real de toda la Empresa.

### P2 — diseñar sin construir

- Catálogo de especialidades **a nivel Empresa** (reutilizable entre obras).
  Guardar con un campo de alcance simple para que sea una migración chica.
- Que la actividad por rol (`/plataforma/actividad`) cuente por método de pago.

---

## Decisión de diseño: dónde viven las especialidades propias

CLAUDE.md pide **no inventar entidades**. Hoy `TradeSpecialty` es un `enum`
cerrado; una propia no cabe ahí. Tres caminos:

| Opción | Cómo | Pro | Contra |
|---|---|---|---|
| **A. Lista en `Project`** (recomendada) | `Project.customSpecialties: { key, label }[]` | Sin modelo nuevo, viaja con la obra, se purga con ella, ya está en `PROJECT_OWNED` | Una obra con cientos de ítems engorda el documento (tope de 100) |
| **B. Colección `Specialty`** | Modelo nuevo con `project` | Escala y se puede pasar a nivel Empresa | **Entidad nueva** → pide tu OK; suma a `PROJECT_OWNED` |
| **C. Texto libre en cada fila** (como `customSpecialty` en proveedores) | Sin catálogo | Cero backend | No se reutiliza ni se filtra, repite typos |

**Recomendación: A.** Es la más chica y encaja con "una propia es de esta obra".
Si más adelante se quiere nivel Empresa (P2), se migra a B sin tocar el selector.

Consecuencia técnica en cualquier opción: `specialty` deja de ser un enum en
Mongoose y en Zod y pasa a **string validado contra base + propias de la obra**,
resuelto en el servicio y **no** con `enum`. Las filas guardan la `key`.

---

## Métricas de éxito

**Indicadores adelantados (2–4 semanas)**
- ≥ 60% de las obras activas con tareas usa alguna de las 3 nuevas o una propia.
- Selección de especialidad en < 5 s (mediana) midiendo apertura → elección.
- "otra" cae al menos a la mitad en tareas y proveedores nuevos.
- ≥ 70% de los cobros nuevos usa un método distinto de `otro`.

**Rezagados (1–3 meses)**
- Menos pedidos de soporte del tipo "no encuentro mi rubro / mi forma de pago".
- Gastos con método cargado ≥ 50%.

Medición: consulta sobre `Activity.specialty`, `Payment.method`, `Expense.method`
(sin analítica nueva; no salen datos personales).

---

## Preguntas abiertas

| # | Pregunta | Quién | Bloquea |
|---|---|---|---|
| 1 | ~~¿"Listado de actividades" es el selector de Especialidad de la tarea?~~ **Resuelta (2026-11-03): es un solo catálogo.** Tareas, personal y proveedores comparten `TradeSpecialty`; no hay catálogo aparte de tipos de tarea. | Producto | No |
| 2 | ¿Qué rol crea especialidades propias? Propuesta: sólo gerente (`project.update`). ¿También supervisor? | Producto | Sí |
| 3 | `transferencia` genérica: ¿se conserva sólo para lo viejo, o se migra a `transferencia_ves`? Propuesta: conservar y ocultar en lo nuevo. | Producto | No |
| 4 | ¿Binance y Zelle necesitan referencia obligatoria (id de operación)? Hoy `reference` es opcional. | Contador del cliente | No |
| 5 | ¿"Diseño" es diseño de interiores, gráfico o de proyecto? Cambia la etiqueta ("Diseño de interiores"). | Cliente | No |
| 6 | Tope de especialidades propias por obra (propuesta: 100). | Ingeniería | No |
| 7 | ¿Las propias deben aparecer en el selector de **proveedor** de la libreta de la Empresa? Es de la Empresa, no de una obra, y choca con `OWNER_ONLY`. Propuesta: no — el proveedor de la libreta usa sólo la base. | Producto | No |

## Plazos y fases

- **Fase 1 (sale ya, bajo riesgo):** R1 + R5 + selector con búsqueda (R2). No
  requiere decisión de modelo salvo agregar `method` opcional en `Expense`.
- **Fase 2:** R3 + R4 especialidades propias, una vez resueltas las preguntas
  #1 y #2 y elegida la opción A.
- Cualquier cambio en `packages/web` sube versión con `pnpm bump:web minor`.
- Sin plazo contractual conocido: confirmar con el cliente.

## Qué se toca (orden del stack)

1. **shared**: `TradeSpecialty`, `PaymentMethod`/`PAYMENT_METHODS`, schemas Zod,
   celda nueva en `permissions`. Rebuildear.
2. **api**: `Activity`, `CrewMember`, `Provider` (`specialty` sin `enum`),
   `Payment` y `Expense` (`method`), servicio de especialidades propias.
3. **web capa 1 y 2**: `src/api/*` y hook con `enabled: isAuthenticated`;
   clave nueva en `QueryKeys`.
4. **UI**: selector único con búsqueda y "Crear…"; formularios de tarea, personal,
   proveedor, cobro y gasto.
5. **i18n**: claves en `es`, `es-ES` y `pt`.
6. **Tests**: unit en shared y API; un E2E del flujo "crear tarea con una
   especialidad propia" con `supervisor` y `gerente` (usa `requiresApi()`).
