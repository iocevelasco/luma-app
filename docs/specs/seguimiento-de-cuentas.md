# Seguimiento de cuentas con membresía

**Estado:** borrador · **Fecha:** 2026-11-05 · **Pantalla:** `/plataforma/usuarios` · **Prototipo:** [`seguimiento-plataforma.html`](../design/prototipos/seguimiento-plataforma.html)

## Resumen

Hoy el admin de la plataforma ve cuántas cuentas hay y cómo crecen, pero no
**cuáles importan** ni **cómo les va**. Esta spec agrega, sobre datos que ya
existen y **sin crear ningún modelo**:

1. **Segmentos**: separar las cuentas con membresía de clientes, empleados y
   cuentas de prueba.
2. **Censo**: cuántas hay de cada tipo y en qué estado está cada membresía.
3. **Embudo**: en qué etapa se cae una cuenta con membresía, por cohorte semanal.
4. **Seguimiento**: una lista, una fila por cuenta con membresía, con su progreso
   y un semáforo que dice a quién escribirle.

Todo se **calcula al pedirlo**. Nada derivado se guarda.

---

## Problema

`/plataforma/usuarios` cuenta todas las cuentas salvo las `@luma.test`. Eso
mezcla gente de naturaleza distinta:

- **Clientes** que entran a ver el estado de su obra y nunca van a pagar.
- **Empleados** (supervisores, contadores, profesionales) invitados a la obra de
  otra persona.
- **Cuentas con membresía**: las únicas que son clientes de Luma.

Con esa mezcla el número de "cuentas" sobreestima la base real, y el admin no
sabe a quién hacerle seguimiento. Cuando alguien se registra hoy, no hay forma de
ver si creó una obra, invitó a alguien o cargó algo. `/plataforma/actividad`
muestra uso por rol, pero **anónimo** a propósito (menos de 5 personas por celda
sale sin cifras): sirve para entender el producto, no para acompañar a una
cuenta.

## Objetivos

1. Que el admin sepa **cuántas cuentas con membresía hay**, y de ellas cuántas
   están en prueba, pagando, con plan ilimitado o vencidas.
2. Que pueda ver **en qué etapa del uso** está cada una y dónde se cae el
   conjunto.
3. Que obtenga una lista corta de **cuentas que necesitan atención** (sin primera
   obra, sin actividad, prueba por vencer, vencida).
4. Que ninguna cifra incluya cuentas de prueba, clientes ni empleados salvo en el
   conteo explícito de su segmento.
5. Que nada de esto exponga **contenido** de las obras (nombres de clientes,
   descripciones, montos): solo cantidades.

## Fuera de alcance

| Qué | Por qué no ahora |
|---|---|
| Registrar último ingreso (`lastSeenAt`) | Es un dato personal nuevo que toca la Política de Privacidad. Primero ver si la "última acción" alcanza |
| Correos automáticos al que se traba | Es la versión más radical y evita mirar listas, pero hay que validar umbrales a mano antes de automatizar |
| Seguimiento de clientes y empleados | No son la base de negocio. Solo se cuentan |
| Montos, presupuestos o nombres por cuenta | Confidencialidad: el admin ve cantidades, nunca contenido |
| Un modelo nuevo (p. ej. "Lead" o "Etapa") | Las etapas se derivan de lo que ya existe |
| Tracking de eventos de la interfaz | No hay instrumentación y la capa derivada cubre lo necesario |
| Exportar a CSV | Sin pedido concreto todavía |

## Definiciones

**Membresía** es la `Subscription` de la Empresa que la persona posee
(`OrganizationMember.role: owner`), en cualquier estado salvo `sin_iniciar`. El
estado sale de `subscriptionState` en `@luma/shared/billing`, no se reimplementa.

Una persona cuenta **una sola vez**, con esta precedencia:

| # | Segmento | Regla |
|---|---|---|
| 1 | Cuenta de prueba | Email `@luma.test`. Fuera de todas las cifras |
| 2 | **Con membresía** | Tiene `Subscription` en estado ≠ `sin_iniciar` |
| 3 | Empleado | Sin membresía y con alguna fila de `ProjectMembership` con rol ≠ `cliente` |
| 4 | Cliente | Sin membresía y solo filas con rol `cliente` |
| 5 | Sin obra | Sin membresía y sin ninguna fila (la sacaron de la obra) |

`account_status: 'inactive'` se cuenta aparte como **bajas**, en cualquier
segmento.

Un invitado no tiene `Subscription`; cuando crea su primera obra se le arranca la
prueba (`decideProjectCreation`) y pasa a ser "con membresía". No hay que hacer
nada especial: el segmento se recalcula.

**Estados de la membresía** que muestra el censo: *En prueba* (`prueba`),
*Pagando* (`activa`, `en_revision`, `pago_fallido`), *Plan ilimitado*
(`ilimitado`), *Vencida* (`vencida`, solo lectura).

**Etapas del embudo** (cada una implica haber alcanzado la anterior en el
conteo del embudo):

1. Registrada: tiene membresía.
2. Correo confirmado: `User.email_verified`.
3. Primera obra: es `Project.createdBy` de al menos una obra.
4. Primer invitado: figura como `ProjectMembership.invitedBy` de alguien.
5. Primera actividad o presupuesto: al menos una acción de `activityCreated` o
   `budgetImported`.
6. Primer gasto o cobro: al menos un `expenseRegistered` o `paymentRegistered`.

Las acciones salen de las mismas fuentes que `platform-activity.service.ts`
(`SOURCES`). **Última acción** es la fecha más reciente entre todas ellas: no es
un ingreso, es una acción registrada.

## Usuarios e historias

**Admin de plataforma**
- Como admin, quiero ver cuántas cuentas tienen membresía y cuántas son clientes,
  empleados o de prueba, para conocer la base real.
- Como admin, quiero ver el estado de las membresías (prueba, pagando, ilimitada,
  vencida), para saber cuánto de la base paga.
- Como admin, quiero ver en qué etapa se caen las cuentas nuevas, para decidir
  dónde intervenir.
- Como admin, quiero una lista de las cuentas que necesitan atención, para
  escribirles antes de que la prueba termine sin que hayan usado Luma.
- Como admin, quiero abrir una cuenta y ver sus cantidades (obras, invitados por
  rol, actividades, última acción), para saber qué decirle.
- Como admin, quiero filtrar el directorio actual por segmento, para encontrar a
  una persona concreta.

## Requisitos

### P0 — Fase 1: segmentos y censo

- **R1. Clasificador puro en `@luma/shared`.** `classifyAccount(facts)` devuelve
  el segmento según la tabla de arriba, con tests de cada precedencia. La API
  lee hechos de la base y le pregunta a shared; la UI muestra lo que la API
  resolvió.
- **R2. Endpoint de censo** (`requireAdmin`): conteos por segmento, bajas, cuentas
  de prueba excluidas, estado de membresía y altas por semana (últimas 12) con y
  sin membresía.
- **R3. Pestaña Censo** como en el prototipo, con la aclaración de cuántas cuentas
  cuenta hoy la pantalla frente a cuántas tienen membresía.
- **R4. Filtro por segmento en el Directorio**, y el segmento visible en cada fila.
- **R5. Roles sin cifras.** Un rol de empleado con menos de `MIN_PEOPLE_PER_CELL`
  personas sale con la cifra en `null`, igual que en Actividad.

*Aceptación*
- Given una cuenta `@luma.test` con membresía, When se calcula el censo, Then no
  suma en ningún conteo.
- Given una persona con membresía propia que además es supervisora en otra obra,
  When se calcula el censo, Then cuenta solo como "con membresía".
- Given un cliente invitado que crea su primera obra, When se recalcula, Then pasa
  a "con membresía" sin intervención.
- Given una cuenta dada de baja con membresía, Then cuenta en bajas y no en "con
  membresía".
- Given el rol "diseñador" con 3 personas, Then la API devuelve `people: null`.

### P0 — Fase 2: embudo y seguimiento

- **R6. Endpoint de embudo**: conteo por etapa y cohortes por semana de alta
  (últimas 6), solo con cuentas con membresía.
- **R7. Endpoint de seguimiento**, paginado, con búsqueda por nombre o correo y
  filtros por estado de membresía y "necesitan atención". Por fila: nombre, correo,
  días desde el alta, estado y días restantes de membresía, etapa, obras, invitados
  por rol, actividades, última acción, semáforo.
- **R8. Semáforo puro en `@luma/shared`** (`accountHealth`), con tests. Primera
  versión, a validar con datos reales:
  - *Solo lectura*: membresía vencida.
  - *No confirmó el correo / Sin primera obra*: etapa ≤ 2 y 3 días o más desde el
    alta.
  - *Se enfrió*: 7 días o más sin ninguna acción.
  - *Prueba por vencer*: 7 días o menos de prueba y sin gasto ni cobro cargados.
  - *Recién llegó*: menos de 3 días.
  - *En marcha*: el resto.
- **R9. Pestañas Embudo y Seguimiento**, con el detalle por fila y el aviso de que
  solo se muestran cantidades.
- **R10. Solo cantidades.** Ningún endpoint devuelve nombres de clientes,
  descripciones ni montos.

*Aceptación*
- Given una cuenta registrada hace 5 días sin obra, When se calcula el semáforo,
  Then "Sin primera obra" con riesgo.
- Given una cuenta con membresía vencida, Then "Solo lectura" aunque tenga actividad
  reciente.
- Given una cuenta con 63 actividades, When se abre su detalle, Then se ve el número
  y ninguna descripción de actividad.
- Given un usuario sin rol de admin, When pide cualquier endpoint, Then 403.
- Given una cuenta de prueba, Then no aparece en la lista de seguimiento.

### P1

- **Escribirle desde Campañas**: el botón "Escribirle" abre una campaña con ese
  destinatario o segmento (hoy Campañas ya existe; falta el puente).
- **Avisos al admin** cuando una cuenta entra en riesgo (resumen semanal).

### P2 — para no cerrar puertas

- `lastSeenAt` en `User` si "última acción" resulta insuficiente.
- Correo automático al que se traba en una etapa.
- Umbrales del semáforo configurables.

## Notas técnicas

- **Rutas** en `routes/admin.ts`, con `requireAdmin`; **servicio** nuevo
  `platform-accounts.service.ts` junto a `platform-users.service.ts`. Se reutiliza
  `REAL_ACCOUNTS` (excluye `@luma.test`) y las `SOURCES` de
  `platform-activity.service.ts`; si hace falta, se extraen a un módulo común en
  vez de copiarlas.
- **Lectura en lote**, sin consulta por cuenta: membresías, obras, invitaciones y
  acciones se traen agrupadas por persona y se unen en memoria, como hace
  Actividad.
- **Obras eliminadas**: el hook de `Project` las esconde. Para "primera obra" se
  usa lo vivo; ver pregunta abierta.
- **Frontend**: capa 1 en `api/platform.ts`, capa 2 en
  `hooks/platform/use-platform-accounts-queries.ts` con `enabled: isAuthenticated`
  y claves nuevas en `QueryKeys`. Pantalla dentro de `PlatformLayout`, pestañas con
  ícono en el `toolbar`, filas como `RowCard`, grupos con `ListSection`.
- **i18n**: claves nuevas en `es`, `es-ES` y `pt` al mismo tiempo; hay test de
  paridad. Los textos de estado y semáforo van por i18n, el frontend ramifica por
  la clave que devuelve la API, no por el texto.
- **Versión**: el cambio toca `packages/web`, así que `pnpm bump:web minor`.
- **Rendimiento**: sin caché. Si el listado supera unos cientos de cuentas con
  membresía y se nota lento, se evalúa, no antes.
- **Tests**: unit en shared (clasificador y semáforo), unit en la API (servicio con
  cuentas de prueba, precedencia y rol suprimido), E2E del flujo del admin con
  `requiresApi()` y la cuenta fija `admin`. Un spec que cree o mueva datos arma su
  propia obra.

## Métricas de éxito

**Indicadores inmediatos** (primeras 2 semanas)
- El admin usa la pestaña Seguimiento al menos 2 veces por semana.
- El 100 % de las cuentas con membresía aparece clasificada, y ninguna cuenta de
  prueba entra en un conteo.

**Indicadores a plazo** (1 a 3 meses)
- De las cuentas que entran en "Sin primera obra", el porcentaje que crea su
  primera obra en los 7 días siguientes a ser contactadas. Línea base: hoy no se
  mide.
- Conversión de "en prueba" a "pagando" de las cuentas contactadas frente a las no
  contactadas.
- Tiempo desde el alta hasta la primera obra (mediana).

Los objetivos numéricos se fijan después de leer el embudo real durante dos
semanas: hoy no hay línea base y cualquier meta sería inventada.

## Preguntas abiertas

| # | Pregunta | Quién | Bloquea |
|---|---|---|---|
| 1 | ¿La Política de Privacidad permite que el admin vea cantidades por cuenta? Si hay que cambiar el texto, sube `LEGAL_VERSION` y todas las cuentas aceptan de nuevo | Legal / producto | Fase 2 |
| 2 | ¿Los umbrales del semáforo (3, 7 y 7 días) son los correctos? | Producto | No |
| 3 | ¿"Primera obra" cuenta las obras ya eliminadas? | Producto | No |
| 4 | ¿"Primer invitado" incluye a quien se invitó y nunca activó la cuenta? | Producto | No |
| 5 | ¿Una cuenta con plan ilimitado entra en el semáforo de "prueba por vencer"? Propuesta: no | Producto | No |
| 6 | ¿"Última acción" alcanza o hace falta `lastSeenAt`? | Admin | No |

## Fases

1. **Fase 1: segmentos y censo** (R1 a R5). Sirve por sí sola: corrige el número de
   cuentas y no toca datos personales nuevos.
2. **Fase 2: embudo y seguimiento** (R6 a R10). Depende de la respuesta a la
   pregunta 1.
3. **Fase 3 (P1)**: puente con Campañas.

Recomiendo cerrar la Fase 1 y leer el censo real antes de afinar el semáforo.
