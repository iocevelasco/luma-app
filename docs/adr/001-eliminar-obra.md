# ADR-001: Eliminar una obra — borrado lógico, papelera de 90 días y qué se lleva

**Estado:** Aceptado (implementado)
**Fecha:** 2026-10-24
**Decide:** Producto + quien mantiene `packages/api`

## Contexto

Las personas piden poder eliminar obras. Una obra es la raíz de un árbol grande:
19 colecciones la referencian con un campo `project` (cobros, gastos, actividades,
documentos, membresías…), algunas guardan archivos en el media-service, y dos
entidades que "parecen" de la obra —proveedores y personal— en realidad se
**comparten** entre las obras de una Empresa.

Restricciones que mandan:

- La plata no se corrige en silencio (CLAUDE.md, "Plata"): borrar un cobro o un
  gasto cambia márgenes. Por eso un borrado debe ser reversible mientras se pueda.
- Pedido explícito: borrado **lógico**, no físico, con TTL de 3 meses, y que quien
  elimina sepa de forma resumida qué se va.
- Un 404 no puede revelar que una obra existe (aislamiento entre clientes).
- Mongo no tiene FK ni cascada: lo que no se borra a mano queda huérfano.

## Decisión

1. **Eliminar = marcar** (`deletedAt`, `deletedBy`, `purgeAt = deletedAt + 90 días`).
   Ninguna fila hija se toca. Restaurar = limpiar los tres campos.
2. **Un hook en `Project`** esconde las eliminadas de todo `find`/`findOne`/
   `findOneAndUpdate`/`count`/`distinct`/`update*`. Quien necesita verlas
   (papelera, restaurar, purgado) lo pide **nombrando `deletedAt` en el filtro**.
3. **Purgado diario** (`purge-deleted-projects`, tarea de Coolify): a los 90 días
   borra de verdad, en este orden: archivos del media-service → hijos de
   actividades → hijos directos de la obra (`PROJECT_OWNED`) → la obra. Si algo
   falla, la obra sigue en la papelera y se reintenta.
4. **Sólo el gerente** (`project.delete`), escribiendo el nombre de la obra; el
   servidor lo vuelve a comprobar. Antes de confirmar, la UI muestra el resumen
   de lo que se va y de lo que se queda.
5. **Restaurar** vuelve a pasar por el límite de la suscripción.

## Qué se borra y qué no

| Dato | Al eliminar (papelera) | Al purgar (día 90) | Por qué |
|---|---|---|---|
| `Project` | Oculta | **Se borra** | Es la obra |
| Actividades, evidencia (fotos), materiales, jornadas, hitos + adjuntos | Intactos, inaccesibles | **Se borran** (con archivos) | Sólo tienen sentido dentro de la obra |
| Presupuesto y líneas, cuotas, **cobros**, **gastos** (+ comprobantes) | Intactos | **Se borran** | Cuelgan de la obra; por eso la papelera existe: es la red contra borrar plata por error |
| Documentos de obra, contrataciones (`ProviderEngagement`) | Intactos | **Se borran** (con archivos) | Idem |
| Membresías (`ProjectMembership`), clientes (`ProjectClient`), notificaciones | Intactos; el acceso se corta porque la obra no resuelve | **Se borran** | El acceso nace de la obra |
| Asignaciones `ProjectCrewMember` / `ProjectProvider`, `ActivityCrew` / `ActivityProvider` | Intactas | **Se borran** | Son vínculos, no entidades |
| **Personal y proveedores de la Empresa** (`scope: 'organization'`, `project: null`) | Intactos | **Se QUEDAN** | Se comparten con otras obras; sólo se suelta el vínculo |
| Personal y proveedores **creados sólo para esa obra** (`scope: 'project'`) | Intactos | **Se borran** | Nadie más los usa |
| `User` (incluidos los invitados a la obra) | Intactos | **Se quedan** | Una cuenta puede estar en otras obras o ser dueña de la suya. **Las cuentas que quedan sin obras no se purgan** (decisión vigente) |
| `Organization`, `OrganizationMember` | Intactos | **Se quedan** | La Empresa sobrevive a sus obras |
| `Subscription`, `SubscriptionPayment`, `StripeEvent` | Intactos | **Se quedan** | Es plata de Luma, no de la obra; cada pago congela su desglose |
| `ExchangeRate` | Intacto | **Se queda** | Dato global |
| Correos ya enviados | — | — | No se pueden retirar |

La lista de lo que se purga es `PROJECT_OWNED` en `project-deletion.service.ts`.
Un test falla si aparece un modelo con campo `project` que no esté ahí.

## Opciones consideradas

### A — Marcar en la obra y esconder con un hook (elegida)

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja: 3 campos + 1 hook + 1 script |
| Reversibilidad | Total hasta el día 90 |
| Riesgo de fuga | Medio: una consulta que no pase por el hook (`aggregate`, driver crudo) vería obras eliminadas |

**Pros:** restaurar es trivial y exacto; no hay que propagar un estado a 19
colecciones; la suscripción deja de contar la obra sin tocar `shared`.
**Contras:** el filtro implícito sorprende a quien lee una consulta; los datos de
la obra siguen ocupando espacio 90 días.

### B — Marcar `deletedAt` en cada colección hija

Complejidad alta (19 modelos, 19 hooks, 19 restauraciones), y cada colección
nueva es un olvido en potencia. Se descarta: el árbol ya cuelga de la obra, y esconder
la raíz esconde todo lo que se llega por ella.

### C — Índice TTL de Mongo sobre `purgeAt`

Complejidad mínima, pero expira **sólo** el documento de la obra: cobros, gastos
y archivos quedan huérfanos para siempre y pasan a contar en consultas que no
filtran por obra. Se descarta; se usa `purgeAt` como dato y un script que cascadea.

### D — Borrado físico inmediato con confirmación

Cumple "CRUD" pero contradice el pedido y la regla de plata: un cobro borrado
no vuelve. Se descarta.

## Trade-offs

- **Reversibilidad vs. higiene de datos.** 90 días de datos "muertos" a cambio de
  poder deshacer un error costoso. El plazo es una constante
  (`PROJECT_TRASH_RETENTION_DAYS`).
- **Filtro implícito vs. explícito.** El hook evita el olvido en cada `find`, a
  costa de magia. Se compensa con la convención "para ver eliminadas, nombrá
  `deletedAt`" y con tests.
- **Archivos primero.** El purgado borra los archivos antes que las filas: si el
  media-service falla, no quedan archivos sin dueño imposibles de encontrar.

## Consecuencias

- Más fácil: eliminar sin miedo, que el soporte recupere una obra, y que
  `billableProjects` / límites de suscripción ignoren las eliminadas sin código nuevo.
- Más difícil: toda consulta nueva sobre obras hereda el filtro (bueno), pero
  `Project.aggregate` y el driver crudo **no** lo heredan; hay que filtrar a mano.
- A revisar: la cuenta de un cliente invitado sólo a esa obra queda viva (sin
  obras) tras el purgado; hoy no se limpia. Y los enlaces firmados de proveedores
  dependen de `ProviderEngagement`: confirmar que mueren con la obra en la
  papelera (la obra ya no resuelve, pero no se probó el enlace de punta a punta).

## Acciones

1. [x] Modelo, hook, servicio, endpoints, UI, i18n (es / es-ES / pt), tests.
2. [x] Script `purge-deleted-projects` + `pnpm --filter @luma/api projects:purge`.
3. [ ] Crear la tarea programada en Coolify (ver `docs/DEPLOY.md`). **Sin ella la
       papelera nunca se vacía.**
4. [ ] Probar el enlace firmado de un proveedor con la obra en la papelera.
5. [x] Cuentas sin obras tras el purgado: **no se tocan, por ahora**.
5b. [x] Invitados (supervisor, contador, cliente) que entran con la obra en la papelera
       ven el aviso «La obra X fue eliminada. Comunicate con el arquitecto o el
       gerente de obra» (`removedProjects` en `GET /api/projects`). El aviso vive
       lo que vive la papelera: al purgar se borra su membresía y, con ella, el
       aviso; después ven la lista vacía.
6. [ ] Aviso por mail al gerente unos días antes del purgado (hoy no hay).
