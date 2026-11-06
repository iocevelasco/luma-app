# Sociedad de agentes

Cómo se reparte un trabajo entre agentes en Luma, quién decide qué y cómo se
entregan los resultados. Este documento **no repite las reglas del proyecto**:
las reglas viven en [`CLAUDE.md`](../CLAUDE.md), [`DESIGN.md`](../DESIGN.md),
[`arquitectura-de-informacion.md`](design/arquitectura-de-informacion.md) y los
documentos de `docs/`; acá se dice quién lee cuál y a quién le toca cumplirla.

> Alcance: es un modelo de trabajo, no infraestructura. Los archivos de
> `.claude/agents/` y `.claude/commands/` son prompts; cargarlos y asignarlos
> depende del entorno (ver [Cómo se usa](#cómo-se-usa)).

## Principio: el filtro más barato primero

Cada agente cuesta tokens y un encargo mal armado cuesta retrabajo (pasar a
"tarea = actividad" tocó 55 archivos, commit `01f0bfb`). Por eso el orden de
defensa es:

1. **Filtros deterministas**, que no gastan nada: `post-edit-check.sh` (tras cada
   Edit/Write), `pre-push-check.sh`, el test de paridad i18n, los tests que
   fallan si falta una entrada en `PROJECT_OWNED` / `USER_REFERENCES`, y el skill
   `verify`.
2. **Un portón de necesidad** antes de codear: `criterio`.
3. **Especialistas** sólo cuando el trabajo lo justifica (ver [Dividir o no](#dividir-o-no)).
4. **Un revisor** de sólo lectura al final. Revisa lo que ningún filtro puede
   juzgar; no repite lo que ya cazaron los hooks y los tests.

Ningún rol de esta sociedad es obligatorio por sí mismo. Un cambio chico lo
hace una sola sesión con `/feature` y no necesita nada de lo que sigue.

## Qué se encontró en el repo

Hechos, no recomendaciones:

- **Capas con orden de compilación**: `packages/shared` → `api` → `web/src/api`
  (capa 1) → `web/src/hooks` (capa 2) → componente → i18n. `api` y `web`
  importan el `dist` de `shared`, así que `shared` se buildea primero
  (`CLAUDE.md`, Paquetes; `/feature`).
- **Una sola grilla de permisos** en `packages/shared/src/permissions/index.ts`:
  los routers declaran `requireCapability`, los controllers `req.can`, la UI lee
  `project.capabilities`.
- **Plata, suscripción y purga tienen reglas que no se negocian** y tests que las
  protegen (`CLAUDE.md`: Plata, Suscripción, Baja lógica, Eliminar una obra).
- **Una pantalla tiene dos fuentes de verdad visual** (`DESIGN.md` y
  `arquitectura-de-informacion.md`) y un hook que verifica parte de ellas.
- **Tres idiomas en la SPA** (`es`, `es-ES`, `pt`) y dos en la landing (`es`,
  `pt`). El hook de i18n sólo compara `es` ↔ `pt`; `es-ES` lo cubre el test de
  paridad de `pnpm test`.
- **Un solo agente y un solo comando previos**: `criterio` (producto, sólo
  lectura) y `/feature` (el orden del stack). Se conservan tal cual.
- **El historial no divide el trabajo por persona**: las mismas cuentas de git
  tocan `api`, `web`, `shared` y `e2e`. Por eso los roles siguen las **capas y las
  responsabilidades**, no a los autores.
- **Actividad por paquete** (commits): `web` 163, `api` 97, `shared` 78, `e2e` 64,
  `landing` 17. La landing es lo bastante poco frecuente como para no tener un
  agente propio.
- **Flujo de entrega**: rama de feature + PR; `git push` a main/master lo frena un
  hook. Evidencia visual de PR en `docs/evidence/<tema>/`.

## Los roles

| Rol | Es | Qué hace | Archivo |
|---|---|---|---|
| **Coordinador** | La sesión principal | Alcance, contrato, reparto, integración, verificación, informe | [`.claude/commands/equipo.md`](../.claude/commands/equipo.md) |
| **criterio** | Subagente, lectura (existente) | Afila el pedido y decide si vale la pena | [`.claude/agents/criterio.md`](../.claude/agents/criterio.md) |
| **backend** | Subagente, escribe | `packages/api` y, en el paso de contrato, `packages/shared` | [`.claude/agents/backend.md`](../.claude/agents/backend.md) |
| **frontend** | Subagente, escribe | `packages/web`, `packages/landing`, `e2e` | [`.claude/agents/frontend.md`](../.claude/agents/frontend.md) |
| **revisor** | Subagente, lectura | Revisión independiente del diff | [`.claude/agents/revisor.md`](../.claude/agents/revisor.md) |

Por qué estos y no otros:

- **backend y frontend** porque son las dos mitades que el repo ya separa en
  paquetes, con reglas propias y un contrato entre ambas (`shared`).
- **`shared` no tiene dueño propio**: es el contrato, y sólo cambia en el paso de
  contrato, antes de que alguien dependa de él. Lo escribe `backend` porque la API
  resuelve capacidades, errores y reglas de plata; `frontend` no lo toca.
- **No hay agente de plata, de diseño ni de landing**: esas reglas caen dentro de
  `backend` o `frontend` (cada uno tiene su lista de lecturas) y las vigila el
  revisor con una lista por área.
- **No hay agente de deploy ni de datos**: operar Coolify o la base real queda
  fuera de lo que esta sociedad hace sola (ver [Autoridad](#límites-de-autoridad)).

### Coordinador

Es la sesión principal, no un subagente. Los subagentes del entorno (`Explore`,
`Plan`) no traen la herramienta `Agent`, y el patrón que ya usa `/feature` es
invocar a `criterio` desde la sesión principal. Quien coordina:

1. Traduce el pedido a un **alcance** y lo escribe como Brief (ver [Handoff](#handoff)).
2. Si el pedido es vago o abre más de un camino, llama a `criterio` **antes**.
3. Resuelve el **contrato** (ver [Decisiones compartidas](#decisiones-compartidas)).
4. Decide si divide ([Dividir o no](#dividir-o-no)) y asigna archivos sin solapes.
5. Integra: lee cada handoff, revisa que se cumplan los criterios de aceptación,
   corre la verificación de cierre (skill `verify`) él mismo —no la delega— y
   llama a `revisor`.
6. Informa a la persona: qué cambió, qué se verificó, qué no, qué decisión queda
   suya.

No escribe código de producto mientras haya especialistas trabajando en él.

### Especialistas: resumen

Cada prompt tiene el detalle (lecturas, archivos, límites, entrega). Acá, el mapa:

| | backend | frontend |
|---|---|---|
| **Tareas típicas** | modelo, controller, route, servicio, capacidad nueva, correo, regla de `shared`, script | pantalla, hook, capa 1, i18n, landing, E2E de un flujo, `pnpm bump:web` |
| **Lee antes** | `CLAUDE.md` (Backend, Plata, Correos, Suscripción), `docs/ROLES.md`; según tema `CORREOS.md`, `SUSCRIPCION.md`, `adr/` | `CLAUDE.md` (Frontend, Errores, Estilos, i18n, Cross-browsing), `DESIGN.md`, `arquitectura-de-informacion.md` |
| **Puede modificar** | `packages/api/**`, `packages/shared/**` (sólo si el Brief abre el paso de contrato), docs de su área | `packages/web/**` (menos `components/ui/`), `packages/landing/**`, `shared/` raíz, `e2e/**`, `docs/evidence/**` |
| **No toca** | `web`, `landing`, `e2e`, `.claude/`, deploy, CI | `packages/api`, `packages/shared`, deploy, CI |
| **Vuelve al coordinador si** | necesita una entidad nueva; el contrato cambia; un permiso no está en la grilla; toca plata, purga o `LEGAL_VERSION` de una forma que el Brief no previó | el contrato no alcanza; una pantalla pide algo que la API no resuelve; el diseño contradice a `DESIGN.md` o a la IA |
| **Verifica** | build de `shared` si lo tocó, `typecheck`, `lint` y unit del paquete | `typecheck`, `lint`, unit del paquete, E2E del flujo nuevo en Chromium |

## Dividir o no

Por defecto, **secuencial y con una sola cabeza**: la mayoría de los trabajos
caben así y no pagan el costo de un brief por agente.

```
¿El trabajo son pocas herramientas en una sola capa?
 └─ sí → la hace el coordinador solo (o /feature). Sin especialistas.
 └─ no ↓
¿Hay una entidad nueva, un permiso nuevo o un contrato que no está decidido?
 └─ sí → paso de contrato primero (ver abajo). Nada se divide antes.
 └─ no ↓
¿Toca api y web, y el contrato ya está en shared y buildeado?
 └─ no → secuencial: un especialista, luego el siguiente, en el orden de /feature.
 └─ sí ↓
¿Los archivos de cada parte son disjuntos y ninguna parte espera el resultado de la otra?
 └─ no → secuencial.
 └─ sí → en paralelo: backend ‖ frontend, cada uno con su Brief.
```

Reglas de paralelo:

- **Sólo en paralelo con archivos disjuntos.** Si dos partes pueden tocar el
  mismo archivo, van en secuencia.
- **El `dist` de `shared` lo buildea el coordinador una vez**, antes de lanzar las
  dos partes. Nadie más lo rebuildea durante el trabajo.
- **Un cambio de contrato en pleno vuelo detiene a las dos partes** y vuelve al
  coordinador; no se arregla "del lado de uno".
- **Revisar y verificar nunca van en paralelo con escribir** sobre los mismos
  archivos.
- Si la división no ahorra trabajo o riesgo, no se divide: un Brief extra se
  paga con retrabajo en cuanto el contrato queda ambiguo.

## Decisiones compartidas

Antes de que arranque cualquier tarea que depende de otra, el coordinador cierra
por escrito, en el Brief, lo que las dos mitades tienen que ver igual:

1. **¿Hay entidad de negocio nueva?** Antes de decir que sí, buscar en
   `packages/api/src/models` y `docs/`: suele ser un campo o un estado. Si de
   verdad hace falta un modelo, **se frena y se le pregunta a la persona**
   (`CLAUDE.md`, Qué es esto). No se delega.
2. **La forma del dato**: tipo y schema Zod en `packages/shared`.
3. **Quién puede**: la capacidad (una celda de la grilla) y qué roles de obra la
   tienen. Cambiar `OWNER_ONLY` o darle a `cliente` algo de `expense.*` es una
   decisión de la persona, no del agente.
4. **El sobre y los errores**: rutas, respuesta `{ success, data }` y los
   `ApiErrorCode` que el frontend va a ramificar.
5. **Del lado web**: nombre de la clave en `QueryKeys`, namespace de i18n, y si la
   pantalla es protegida o pública (`enabled: isAuthenticated` / `skipAuth`).

El contrato se **materializa** antes de dividir: `backend` escribe el tipo y el
schema en `shared`, el coordinador corre `pnpm --filter @luma/shared build` y
confirma que compila. Recién ahí `frontend` empieza contra ese `dist`. Si el
contrato no se puede fijar, el trabajo no se divide.

## Revisión independiente

`revisor` es un subagente de sólo lectura (`Read`, `Grep`, `Glob`), igual que
`criterio`. Es independiente porque:

- **Recibe el Brief y el diff, no el razonamiento de quien escribió.** No hereda
  las excusas.
- **No edita.** Devuelve hallazgos; arregla quien corresponda.
- **No es quien verifica.** `verify` lo corre el coordinador; el revisor juzga lo
  que un test no ve.

Qué mira, según los archivos que toca el diff:

| Si el diff toca… | Revisa… | Fuente |
|---|---|---|
| `models`, `services/finance*`, `commitment`, `expense`, `payment` | las cuatro cifras de plata no se suman; nada derivado se guarda; moneda y cotización congeladas; cobros no se editan; `payment.*` y `expense.*` en rutas separadas | `CLAUDE.md` Plata |
| `permissions`, `routes`, `requireCapability`, `req.can` | permiso por capacidad, nunca por rol; la celda de la grilla; que `cliente` no llegue a gastos ni margen | `CLAUDE.md` Backend, `docs/ROLES.md` |
| un modelo nuevo | `PROJECT_OWNED` si tiene `project`; `USER_REFERENCES` si referencia a `User`; baja lógica | `CLAUDE.md` Backend, `adr/001` |
| `subscription*`, `billing`, `stripe*` | reglas en `@luma/shared/billing`, no en controllers; vencida = sólo lectura en un solo lugar; no se cruza con cobros de obra | `CLAUDE.md` Suscripción, `docs/SUSCRIPCION.md` |
| errores en `controllers` | se lanza (`throw notFound(...)`), `code` estable, un 500 no filtra el error real, mensaje en castellano | `CLAUDE.md` Errores |
| `legal`, texto de `/legal`, borrado o retención de datos | `LEGAL_VERSION` sólo si cambian derechos u obligaciones; el texto sigue siendo cierto | `CLAUDE.md` Términos y Privacidad |
| `email*` | plantilla única, `escapeHtml()`, nunca voltea la acción, entra a `email-preview.ts` | `docs/CORREOS.md` |
| `advisor`, `chat`, `components/chat` | `projectId` cerrado en la herramienta, contenido del modelo no confiable, sin claves en el cliente | `CLAUDE.md` Consultor IA, `docs/CHAT-SEGURIDAD.md` |
| `web/src/api`, `hooks`, `components` | ningún componente importa `apiClient`; `enabled: isAuthenticated`; clave en `QueryKeys`; banner al fallar un formulario, toast sólo si no hay | `CLAUDE.md` Frontend, Errores en la UI |
| pantallas, estilos | tokens y escala de radio, IA del panel, `RowCard`/`ListSection`, `components/ui/` intacto | `DESIGN.md`, `arquitectura-de-informacion.md` |
| cualquier texto visible | clave en **todos** los idiomas del paquete (incluido `es-ES`, que el hook no compara) | `CLAUDE.md` i18n |
| APIs del browser, fechas, viewport | `typeof window.X`, fechas ISO con `T`, `100dvh`, fallback en el mismo cambio | `CLAUDE.md` Cross-browsing |
| `packages/web` | `pnpm bump:web` aplicado | `CLAUDE.md` Deploy |

**Evidencia de PR.** `CLAUDE.md` pide que, si el cambio toca una pantalla, la
revisión deje una captura por pantalla modificada, en Chromium y con la cuenta
fija del rol que la ve (`e2e/fixtures/users.json`), más móvil si es responsive.
`revisor` no puede capturar (es de lectura): **entrega la lista de pantallas ×
rol que hace falta capturar** y el coordinador las toma. Una pantalla que no se
pudo capturar se lista aparte, con el motivo; no se da por revisada. El
antecedente en el repo es `docs/evidence/<tema>/` con archivos
`<n>-<estado>-desktop.png` / `-movil.png`.

## Handoff

Un solo formato para todo el equipo. **El coordinador llena la primera mitad al
asignar; el especialista llena la segunda al entregar.** Se pega tal cual en el
prompt del subagente.

```markdown
## Brief  (lo llena el coordinador)
**Objetivo:** una frase, desde lo que la persona observa.
**Criterios de aceptación:** lista verificable. Incluye qué pasa si falla (vacío,
error, 401, permiso denegado) y el alcance mínimo; lo que queda afuera, nombrado.
**Archivos asignados:** rutas o carpetas que puede modificar. Nada fuera de eso.
**Dependencias:** qué tiene que existir antes (p. ej. `shared` buildeado) y qué
otra parte corre en paralelo.
**Decisiones tomadas:** el contrato (ver Decisiones compartidas): tipo, capacidad,
código de error, clave de query, namespace i18n. No se reabren sin volver al
coordinador.
**Lecturas:** documentos que le tocan a este rol.

## Entrega  (la llena quien trabajó)
**Cambios:** archivos tocados, una línea cada uno, y por qué.
**Decisiones propias:** lo que decidió sin preguntar, marcado como suposición.
**Validaciones:** comando corrido → resultado real. Lo que NO corrió, dicho.
**Bloqueos / devoluciones:** lo que necesita del coordinador o de la persona.
**Fuera de alcance visto:** lo que notó y no tocó.
```

Reglas del handoff: sin "listo" sin comando corrido y su salida leída (skill
`verification-before-completion`); un archivo fuera de los asignados es una
devolución, no una edición; una suposición sin marcar cuenta como una decisión
tomada a escondidas.

## Límites de autoridad

### Requiere autorización explícita de la persona, cada vez

- **Git hacia afuera**: `commit`, `push`, abrir PR, merge. Ningún especialista lo
  hace. El flujo del repo es rama de feature + PR y `pre-push-check.sh` frena
  main/master; nada de eso se saltea.
- **Una entidad de negocio nueva** (modelo Mongoose), y **migraciones**
  (`migrate:*`).
- **Cambios que obligan o prometen algo**: subir `LEGAL_VERSION`; tocar lo que la
  Política de Privacidad promete (backups, purga a los 90 días, no vender datos);
  cambiar `OWNER_ONLY` o la visibilidad de plata para el cliente; cambiar los
  números de `PLAN` (la landing los repite y se cambian juntos).
- **Comandos con datos o servicios reales**: `seed:admin`, `accounts:purge`,
  `projects:purge`, `stripe:setup`, `subscription:reminders`, `rates:refresh` y
  cualquier cosa contra una base que no sea local. `settings.json` ya niega
  `deploy`, `coolify-deploy.sh`, `mongo-backup.sh` y `seed:admin`.
- **Multimedia con costo** (`media-gen`): se muestra la estimación y se espera el
  OK; nunca `--yes` por cuenta propia.
- **Coolify y despliegue** (variables de entorno, dominios, tareas programadas,
  servicios): primero el skill `coolify-deploy` y inspeccionar (list/get). Las
  herramientas destructivas piden aprobación.

### Fuera del alcance de esta sociedad

- Repositorios ajenos a este: **NexusBot** (el chat), según `docs/CHAT-SEGURIDAD.md`
  es un repo aparte; lo que falte allí se anota, no se toca desde acá.
- Operación de infraestructura (VPS, backups, DNS), paneles de terceros (Stripe,
  Resend) y datos reales de personas.
- La base de datos real: el MCP de MongoDB está en `--readOnly` y es para leer; las
  pruebas usan las cuentas fijas de E2E (`@luma.test`), nunca cuentas de personas.
- Los documentos fuente del producto (`DocumentoFuncional-*.docx|pdf`).

### Siempre

- Credenciales por clave de `e2e/fixtures/users.json`, jamás escritas a mano; ni
  secretos en archivos que se commitean.
- Ningún agente edita `.claude/settings.json`, hooks ni `.claude/agents/` como
  parte de una tarea de producto: cambiar la sociedad es su propio pedido.
- No hay WebKit ni otros motores: E2E sólo en Chromium.

## Cómo se usa

Entorno: **Claude Code**. Lo que se observa de él y lo que no:

- Los archivos de `.claude/agents/*.md` (frontmatter `name`, `description`,
  `tools`) son el formato que ya usa `criterio`, y `criterio` aparece como tipo
  de agente disponible. Los tres roles nuevos siguen el mismo formato, así que se
  invocan igual: `Agent(subagent_type: "backend" | "frontend" | "revisor")`.
  Esta documentación no instala nada ni garantiza que una sesión ya abierta
  recargue los roles: si no los lista, abrí una sesión nueva o cargalos a mano
  (siguiente punto).
- Si un entorno **no** descubre los roles solo, el coordinador los carga a mano:
  lee el archivo del rol y lo pega como prompt de un agente genérico, seguido del
  Brief, y limita las herramientas por el texto del prompt.
- El coordinador se activa con `/equipo <pedido>`
  ([`.claude/commands/equipo.md`](../.claude/commands/equipo.md)): vuelve a la
  sesión principal el coordinador y le da el protocolo. Un pedido chico no
  necesita `/equipo`; usá `/feature`.
- Las herramientas de cada subagente son las que dice su frontmatter. Los permisos
  de comandos siguen siendo los de `.claude/settings.json`.

## Mantenimiento

- Una regla del proyecto cambia en `CLAUDE.md` (o en su fuente), no acá. Si un
  prompt de rol la repite, está mal: enlazala.
- Un rol nuevo se justifica con un área que tenga reglas propias, tests propios y
  actividad real. Si no, es una lista de lecturas dentro de un rol existente.
- Si agregás una regla que se puede verificar con un grep, va al hook antes que a
  un prompt (`CLAUDE.md`, Cómo está configurado Claude acá).
