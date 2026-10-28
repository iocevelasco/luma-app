# Roles de obra

Cómo la matriz de roles del cliente se traduce en permisos de la app, y qué
falta todavía.

> **La grilla con los permisos reales es
> [`packages/shared/src/permissions/index.ts`](../packages/shared/src/permissions/index.ts).**
> Este documento explica el modelo y mapea las filas de la matriz; no repite
> los valores. Si alguna vez se contradicen, manda el código — y arreglá este
> archivo.

## El modelo en tres líneas

1. El rol es **por obra**, no por Empresa. Quien creó la obra es `gerente`
   por `Project.createdBy` (el **dueño**, sin fila); todos los demás roles son
   filas de `ProjectMembership`, y eso incluye a otros gerentes: **hasta 5 por
   obra, el dueño incluido** (`MAX_PROJECT_MANAGERS`). Otro gerente hace todo lo
   del gerente salvo lo que la grilla reserva al dueño (`OWNER_ONLY`): eliminar
   la obra, sacar o degradar a otro gerente y administrar la libreta de
   proveedores de la Empresa.
2. Nada pregunta por el rol. Todo pregunta por **capacidad**:
   `requireCapability('activity.plan')` en los routers, `req.can(...)` en los
   controllers, `project.capabilities` en la UI.
3. La API resuelve las capacidades y las manda ya aplicadas. El frontend no
   las vuelve a derivar — si lo hiciera, habría dos copias de la grilla.

El **proveedor no es un rol** acá: no tiene cuenta ni membresía. Su permiso va
a nacer del `ProviderEngagement` y viajar en un enlace firmado. Todavía no está
construido.

## Matriz del cliente → qué hay hoy

### Gerente de obra

| Fila de la matriz | Estado |
|---|---|
| Cargar planificación de obra | ✅ `activity.plan` |
| Reportar avance por etapas concluidas | ✅ `activity.review` |
| Actualizar pagos recibidos del cliente | ✅ `payment.write` |
| Cargar documentación y planos de ejecución | ✅ `document.write` |
| Reportar y actualizar fecha de inicio de proveedores | 🟡 parcial — `ProviderEngagement.estimatedStartDate` existe, sin aviso al proveedor |
| Reportar hitos y cambios fundamentales | ✅ `milestone.publish` |
| Reportar gastos: materiales, herramientas, nómina, insumos | ✅ las cinco categorías, con comprobante y multimoneda |

### Supervisor de obra

| Fila de la matriz | Estado |
|---|---|
| Reportar personal en obra: entradas y salidas | ✅ `crew.attendance.write` |
| Reportar llegada y salida de materiales y herramientas | ✅ `material.write` |
| Generar lista de compra de materiales y herramientas | 🟡 parcial — carga materiales en estado `pendiente`; no hay "lista de compra" como objeto |
| Notificar eventualidades sólo al gerente | ✅ `milestone.report` con audiencia `interno` |
| Notificar incongruencias de planos y realidad | ✅ eventualidad interna enlazada a la actividad |
| Cargar fotos de avances diarios | ✅ `activity.evidence.write` |

### Cliente

| Fila de la matriz | Estado |
|---|---|
| Revisar estatus de ejecución de obra | ✅ `activity.read` |
| Revisar cronograma de pagos acordado | ✅ `payment.read` |
| Recibir notificaciones de próximo pago | 🟡 el dato está; falta la tarea programada que lo dispare |
| Recibir notificaciones de actividad iniciada/avanzada/cumplida | ✅ in-app; sin mail todavía |
| Recibir notificación de hito en obra | ✅ in-app; sin mail todavía |
| Reportar un detalle por atender al equipo gerencial | ❌ no hay canal del cliente hacia adentro |
| Acceder a documentación, planos y renders | ✅ `document.read` |
| Acceder a fotos de compras realizadas | ❌ hay evidencia de actividad, no de compras |

### Contador

Rol nuevo, no está en la matriz original del cliente. Lleva cobros y gastos y
**nada más**: no ve actividades, personal, proveedores ni documentación. Es el
único rol además del gerente que ve gastos, y por lo tanto el margen — no se
puede llevar la contabilidad de una obra viendo un solo lado.

### Proveedor

Nada todavía. Ver arriba.

## Dos ajustes respecto de la v1

Son los que conviene mirar con cuidado, porque **quitan** permisos que alguien
tenía:

1. **El supervisor no planifica.** La matriz le da "cargar planificación" al
   gerente y al supervisor sólo "reportar". Entonces mueve el estado de una
   actividad y le carga notas y fotos, pero no la crea, no la borra, y no le
   cambia fechas, responsable ni especialidad. El Asistente de Obra de la v1
   sí hacía todo eso.
2. **El supervisor no ve plata.** Ni presupuesto, ni Consultor IA, ni montos de
   contratación. La matriz le da compras y herramientas, no economía.

3. **El supervisor reporta hacia adentro, no hacia el cliente.** Puede crear
   eventualidades internas (`milestone.report`) pero no publicar un hito al
   cliente (`milestone.publish`), ni editar o borrar uno que el gerente ya
   publicó. Su fila dice "notificar eventualidades **solamente al gerente**".

Si alguno está mal leído, es una celda de la grilla.

## Cobros y gastos

**Dos flujos separados desde el modelo, no desde la pantalla.** Los cobros
(`payment.*`) los ve el cliente; los gastos (`expense.*`) no. Si fueran una
sola sección, el cliente podría calcular el margen restando — es la regla 13.

Cada movimiento lleva su moneda y la cotización del día en que pasó, congelada:
un gasto de agosto vale lo que valía en agosto. Nada derivado se guarda —
saldos, estados de cuota y margen se recalculan siempre en `finance.service.ts`.

La nómina se **calcula** desde `LaborRecord` × `CrewMember.dailyRate`, contando
un día por persona por fecha aunque haya estado en tres actividades. A quien no
tiene jornal cargado se lo informa aparte en vez de contarlo como cero.

Los cobros no se editan: son hechos con fecha. Se borran y se cargan de nuevo.

## Notificaciones

Son in-app: una fila por persona en `Notification`, bandeja en el header con
badge de no leídos, polling cada 60s. Se disparan solas en:

| Evento | Quién recibe |
|---|---|
| Actividad pasa a `en_curso` | gerente, supervisor, cliente |
| Actividad pasa a `en_revision` | **sólo el gerente** — puede volver atrás, no es avance |
| Actividad pasa a `completada` | gerente, supervisor, cliente |
| Hito con audiencia `cliente` | los tres |
| Eventualidad interna | gerente y supervisor |

Nadie se avisa a sí mismo. Un fallo al repartir avisos **nunca** voltea la
acción que lo disparó: se loguea y se sigue.

**Todavía no se manda mail.** El servicio de Resend ya está y el enganche es
chico, pero prender el mail en todos estos eventos es una decisión de producto
—cuántos correos tolera un cliente por semana— y no la tomé solo.

## Un efecto que conviene tener presente

El roster de la Empresa (`OrganizationMember`) **ya no da acceso a ninguna
obra**. Sigue existiendo como camino de alta —crea la cuenta y manda el mail de
activación— pero el acceso se invita obra por obra. La pantalla lo dice.

## Migración

El acceso de la v1 se migra con:

```bash
pnpm --filter @luma/api exec tsx src/scripts/migrate-project-memberships.ts --dry-run
pnpm --filter @luma/api migrate:memberships
```

- Cada `ProjectClient` pasa a ser una membresía `cliente` — es un renombre.
- Cada Asistente de Obra pasa a ser `supervisor` **en cada obra de su
  Empresa**, porque su acceso era org-wide y hay que materializarlo para no
  sacarle nada. De ahí en adelante el acceso deja de propagarse solo: a las
  obras nuevas hay que invitarlo.

Es idempotente y no borra nada. `ProjectClient` queda en pie para poder volver
atrás; se elimina cuando la migración lleve un ciclo en producción.

**Si no corre, los Asistentes de Obra quedan sin acceso.** Es a propósito:
entre que falte un permiso y que sobre, falta.
