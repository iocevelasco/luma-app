# ADR-002: Tiempo real por obra — un canal SSE que avisa, no que entrega

**Estado:** Aceptado (implementado; falta la prueba de entorno de más abajo)
**Fecha:** 2026-11-05
**Decide:** Producto + quien mantiene `packages/api` y `packages/web`

## Contexto

Una obra la usan varias personas a la vez (gerente, supervisor, profesionales,
cliente). Hoy, si el gerente actualiza una compra, el supervisor no se entera
hasta que recarga.

La causa no era el transporte: la SPA usaba `staleTime` de 5 minutos global y ninguna
pantalla de obra hacía polling ni refetch al foco. En TanStack Query v5 el refetch
al enfocar o al montar sólo ocurre si la query está **vencida**, así que un cambio
ajeno tardaba hasta 5 minutos en verse.

Lo que más importa en tiempo real son **Actividades** (Tablero, Cronograma) y
**Materiales** (Compras): son donde dos personas trabajan sobre lo mismo. El resto
(cobros, gastos, presupuesto, hitos…) lo ven pocas personas y casi nunca a la vez.

Restricciones que mandan:

- **Plata** (CLAUDE.md): `payment.*` lo ve el cliente, `expense.*` no. Que un
  cliente se entere de que "hubo un gasto" ya es una fuga, aunque no vea el monto.
- La autorización de lectura vive en un solo lugar: `requireProjectAccess` y la
  grilla de `@luma/shared/permissions`. No se duplica.
- Un solo contenedor `app` en Coolify detrás de Traefik, Mongo propio. Sin Redis.
- iPhone cuenta como navegador de primera: todo browser de iOS es WebKit.

## Decisión

1. **Dos niveles, y el polling nunca se va.**
   - *Fase 0, para todo*: listas de obra con `staleTime` de 30 s y, mientras la
     pantalla está a la vista, `refetchInterval` de 30 s (`lib/query-freshness.ts`).
   - *En vivo*, sólo para Actividades y Materiales: un canal SSE por obra. El polling
     sigue debajo como red de seguridad.
2. **El canal avisa, no entrega.** El evento es `{ v, projectId, resources, at }`:
   sin ids de entidades, nombres, montos ni quién lo hizo. La pantalla invalida su
   caché y vuelve a pedir por la API de siempre, que aplica los permisos del rol.
3. **Filtro por capacidad de lectura.** Cada recurso en vivo declara la capacidad
   que lo lee (`LIVE_RESOURCE_READ_CAPABILITY`: `activity.read`, `material.read`) y
   cada conexión guarda sus capacidades al abrir. El cliente sin `purchasesVisibleToClient`
   no se entera de que cambió Materiales.
4. **Qué cambió sale de la capacidad que exigió la ruta.** `requireCapability` deja
   `res.locals.exercisedCapability`; el middleware `publishLiveChanges`, montado
   sobre `/activities` y `/materials`, publica tras un 2xx lo que dice
   `LIVE_WRITE_EFFECTS`. Una ruta futura que declare su capacidad entra sola, y un
   test de `shared` falla si una capacidad nueva `activity.*`/`material.*` no dice qué hace.
5. **Autenticación con el `Bearer` de siempre**, abriendo el stream con `fetch`
   (`apiClient.openStream`, que hereda la renovación del token ante un 401). Sin token
   en la URL (queda en logs y proxies) y sin la cookie de refresh (dura 90 días y
   reabre el secuestro entre sitios).
6. **Un cambio de quién puede qué corta las conexiones de la obra** (miembros, roles,
   papelera, y los flags `purchasesVisibleToClient` / `providersVisibleToClient`:
   `closeLiveOnAccessChange`). Reconectan y se autoriza de nuevo. Cortar cuesta (cada
   cliente se vuelve a autorizar y hace un resync), así que editar el nombre o las fechas
   de la obra **no** corta: sólo lo que mueve permisos.
7. **Acotado por diseño** (`LIVE_CONFIG`): 4 conexiones por persona (se cierra la más
   vieja), 500 en el proceso (después 503 y la SPA hace polling), vida máxima de
   20 min con jitter, latido de 20 s, buffer de 64 KiB por cliente, y el contador
   (sin lectura de obra) recibe 204 y no abre conexión.
8. **El cliente asume que la conexión se cae**: watchdog por silencio, `ready` de una
   reconexión dispara un resync de todo lo vivo, cierre en segundo plano pasados 30 s,
   backoff exponencial con jitter, y degradación a polling sin intervención.

## Qué NO se hizo, y por qué

| Descartado | Razón |
|---|---|
| **WebSocket / Socket.IO** | El tráfico es casi todo servidor→cliente y las escrituras ya van por REST. Suma el *upgrade*, una superficie de ataque mayor y nada que se use. Se reevalúa si aparece presencia o edición colaborativa. |
| **Servicio gestionado (Ably, Pusher, Supabase…)** | El costo no decide (gratis o < US$ 50/mes a esta escala). Decide que sería un subencargado nuevo para datos de obra —obligaría a tocar `legal.page.*` y quizá `LEGAL_VERSION`—, que duplica la autorización en tokens con TTL y que una membresía revocada seguiría recibiendo hasta que venza. |
| **Centrifugo / Mercure** | Otro contenedor, otro secreto y una grilla de permisos duplicada fuera de la API. Centrifugo es el candidato cuando haya 2+ réplicas. |
| **Change streams de Mongo** | Exigen replica set (el Mongo de Coolify es standalone), y los updates parciales no traen `projectId`. |
| **Hooks de Mongoose para publicar** | El código usa mucho `updateMany`/`deleteMany`/`insertMany`, que no pasan por middleware de documento. |
| **Mandar el dato en el evento** | Obliga a autorizar por receptor y por campo y a serializar por rol. Con "sólo avisar" la autorización de la lectura no se toca. |
| **Presencia ("quién está viendo")** | Pide canal bidireccional, expone actividad individual (se puede leer como monitoreo laboral) y no resuelve el riesgo real, que es pisar cambios. |
| **Compartir la conexión entre pestañas** | Optimización de escritorio que hoy no se justifica; el servidor ya limita por persona. |
| **Dinero en vivo** (cobros, gastos, resumen) | Lo ven pocas personas y la fuga de metadatos pesa más que la ventaja. Va por polling. |

## Trade-offs

- **Instancia única.** El hub vive en la memoria del proceso. Con una segunda
  réplica de la API un cambio hecho en una no llega a los clientes de la otra. El
  paso siguiente es Redis/Valkey Pub/Sub detrás de la misma interfaz (`publish` / `open`),
  o Centrifugo; no hace falta antes.
- **Cada deploy corta todos los streams.** `SIGTERM` avisa (`bye: shutdown`) y la SPA
  reconecta con jitter. El polling cubre el hueco.
- **Escrituras por fuera de HTTP no avisan** (tareas de Coolify, seeds, purgas): hoy
  sólo borran datos ya invisibles. Se corrigen con el siguiente refetch.
- **El polling queda activo aun con el canal sano**, pero espaciado: Actividades y
  Materiales pasan de 30 s a 2 min mientras el canal está en `live`
  (`polledList(live)`, leyendo `useLiveStatus`) y vuelven a 30 s si cae. Es lo que
  sostiene a iPhone cuando el stream muere sin avisar.
- **Un refetch no pisa un cambio optimista.** Mover una tarjeta o una barra del Cronograma
  escribe la caché antes de que conteste la API; un refetch que llega en ese lapso es
  anterior al cambio. `useAllActivities` conserva la caché mientras hay una mutación
  optimista en vuelo (`keepWhileMutating`) y la mutación invalida al terminar.
- **Una baja de cuenta no corta sus streams abiertos.** Hoy ningún camino HTTP desactiva
  cuentas (se hace por fuera de la API), así que no hay dónde enganchar el corte. La
  persona conserva el stream hasta el tope de vida (~22 min con jitter) y sólo recibe
  `{ projectId, resources }`, sin datos. Al reconectar, el controller consulta la cuenta
  y la rechaza. Si aparece un camino de baja dentro de la API, es donde llamar a
  `liveHub.closeProject` / un `closeUser`.
- **Dos refetch por escritura propia** (el de la mutación y el del aviso): la ventana
  de 250 ms + jitter los junta casi siempre. Si las métricas muestran duplicados, el
  paso es un `originId` por pestaña.
- **Última escritura gana.** Un formulario abierto no se reinicia por un cambio ajeno
  (`usePinnedWhileOpen`), pero tampoco hay control de versión: si dos personas editan
  la misma actividad, gana quien guarda último. Un `409` por `updatedAt` es lo que cierra
  ese hueco (ver Acciones).

## Consecuencias

- Más fácil: sumar un recurso en vivo es una línea en `LIVE_RESOURCES`, otra en
  `LIVE_RESOURCE_READ_CAPABILITY`, las escrituras en `LIVE_WRITE_EFFECTS` y la clave
  en `LIVE_QUERY_KEYS`. Los tipos obligan a lo primero y un test a lo segundo.
- Más difícil: se mantiene una conexión por pestaña abierta, y hay que mirar
  `liveHub.stats()` cuando crezca el uso.
- **Al comentario de `use-notification-queries.ts`** que descartaba los websockets
  para avisos: sigue siendo cierto para la campanita, que queda por polling.

## Acciones

1. [x] Contrato y mapas en `@luma/shared/live`, con test de cobertura de la grilla.
2. [x] `LiveHub`, controller, ruta, middleware de publicación y de corte; `LIVE_CONFIG`.
3. [x] Excluir `text/event-stream` de `compression`, y `no-transform`.
4. [x] Cierre ordenado en `SIGTERM`.
5. [x] Cliente: `openStream`, parser SSE, conexión con watchdog/backoff/pausa, batcher,
       `useProjectLive` en `DashboardLayout`.
6. [x] Fase 0: `staleTime`/polling de 30 s en las listas de obra; la campanita refresca
       Actividades e Hitos al llegar un aviso nuevo.
7. [x] Formularios de edición de actividades y proveedores de obra, congelados mientras
       están abiertos.
8. [ ] **Prueba de entorno antes de confiar en el canal** (ver `docs/DEPLOY.md`,
       "Tiempo real"): `curl -N` a través de Traefik, HTTP/2, un stream de más de 5
       minutos, y **un iPhone real con la PWA instalada**, en iOS 18 y 26.x, bloqueando
       la pantalla y volviendo. Las fuentes no resuelven cómo se comporta WebKit en
       segundo plano: es la mayor incertidumbre.
9. [ ] Control de versión (`updatedAt` → `409`) en el PATCH de actividades.
10. [ ] Métricas: conexiones abiertas, avisos por minuto, y cuántos refetch dispara cada
        aviso, antes de ajustar los límites de `LIVE_CONFIG`.
11. [ ] Cuando haya más de una réplica de la API: Redis/Valkey Pub/Sub o Centrifugo.
12. [x] El E2E `e2e/live-updates.spec.ts` pasó contra la API local y un servidor web propio
        (es-AR). No se corrió la suite completa contra `main`: 11 specs ajenos fallan, con
        pinta de desfase de textos es-ES / es-AR.
