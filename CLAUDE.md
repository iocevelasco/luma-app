# Luma — Guía del proyecto

## Qué es esto

Plataforma de gestión de obras de construcción: monorepo pnpm con API, SPA y
landing. Qué hay hoy lo dicen los modelos de `packages/api/src/models` y `docs/`,
no este archivo.

**No inventes entidades de negocio.** Si una tarea necesita un modelo nuevo,
preguntá antes de crearlo — y antes de decir que algo no existe, buscalo: lo que
parece nuevo suele ser un campo o un estado de un modelo que ya está.

## Paquetes

| Paquete | Qué es |
|---|---|
| `packages/api` | Node + Express 4 + Mongoose 8 + TypeScript ESM |
| `packages/web` | Vite 6 + React 19 + Tailwind v4 + shadcn/ui |
| `packages/landing` | Vite + React + i18next, estática, servida por nginx |
| `packages/shared` | Tipos + schemas Zod que comparten API y web |
| `shared/` (raíz) | Archivos que usan varios paquetes sin build ni dependencias (hoy los trazos del logo). Alias `@shared/*` en web y landing; los dos Dockerfiles la copian. No es un paquete de pnpm ni se confunde con `packages/shared` |

Los scripts están en el `package.json` raíz. `packages/shared` se buildea
**primero** en todos: `api` y `web` lo importan por nombre contra su `dist`.

## Backend

- **Auth**: access token en `Authorization: Bearer`, refresh en cookie httpOnly
  `refresh_token` (90 días). HS256 si hay `JWT_SECRET`, si no RS256 con el par PEM.
- **Roles de plataforma**: `admin` y `user`. Middlewares: `isAuthenticated` →
  `requireAdmin` | `requireRole`. No gatean ninguna pantalla del panel de obras:
  el admin tiene su propia área, `/plataforma` (cuentas y pagos), con
  `PlatformLayout`. Una pantalla de administración global no va en `DashboardLayout`.
- **Roles de obra**: `gerente` | `supervisor` | `contador` | `cliente`, por obra y
  no por Empresa. El gerente sale de `Project.createdBy`; los otros tres son filas
  de `ProjectMembership`. **Quién puede qué vive en una sola grilla**:
  `packages/shared/src/permissions/index.ts`. Los routers declaran la acción con
  `requireCapability('activity.plan')` y los controllers preguntan con
  `req.can(...)` — nunca por rol. La UI lee `project.capabilities`, que la API ya
  resolvió. Agregar un permiso = una celda en la grilla. Si escribís
  `role === 'supervisor'` en cualquier lado, estás en el camino equivocado.
- **Baja lógica**: `account_status: 'inactive'` + `enabled: false`. Nunca se borra
  el documento. A los 90 días `purge-deactivated-accounts` (tarea diaria de
  Coolify) borra los datos personales y marca `purgedAt`; el documento queda porque
  obras, cobros y gastos lo referencian. Qué se borra vive en
  `account-purge.service.ts` (`USER_REFERENCES`, `PERSONAL_FIELDS`): un test falla
  si agregás un modelo con referencia a `User`, o un campo que parezca un dato
  personal, sin decir qué se hace con él al purgar. La Política de Privacidad
  promete ese borrado.
- **Eliminar una obra** es lógico: `Project.deletedAt` + `purgeAt` (90 días). El
  hook de `models/Project.ts` esconde las eliminadas de todo `find`/`count`/
  `update`; sólo la papelera y el restaurar las piden **nombrando `deletedAt` en
  el filtro**. Lo que cuelga de la obra lo borra `purge-deleted-projects` con
  `PROJECT_OWNED` en `project-deletion.service.ts`: **un modelo nuevo con campo
  `project` se suma a esa lista** (un test falla si no). Sólo el gerente
  (`project.delete`).
- **Términos y Privacidad**: un solo documento, versionado por `LEGAL_VERSION` en
  `@luma/shared/legal`. La aceptación es un hecho en `User`; si está al día lo
  resuelve la API en `AuthUser.terms_pending` y la UI no lo deriva. Se acepta en
  registro y activación (`acceptedTerms: true`) y, para cuentas viejas o una
  versión nueva, en `TermsGate`. El texto vive en i18n (`legal.page.*`, página
  `/legal`). **Subí `LEGAL_VERSION` sólo cuando el cambio toca derechos u
  obligaciones**: obliga a todas las cuentas a aceptar de nuevo. Lo que el texto
  promete (no vender datos, backups diarios, purga a los 90 días) tiene que seguir
  siendo cierto: si cambiás una de esas cosas, cambiá el texto en el mismo PR.
- **Errores**: toda respuesta de error es `{ success: false, error, code, details? }`;
  las exitosas, `{ success: true, data }`.
  - `code` es un `ApiErrorCode` de `@luma/shared`, estable. **El frontend ramifica
    por `code`, nunca comparando el texto.**
  - En código nuevo **lanzá** el error: `throw notFound('No encontramos esa
    obra.')` de `utils/errors.ts`; el `errorHandler` lo formatea. Un
    `return res.status(...)` arma la respuesta a mano. `normalizeErrors` cubre los
    que quedan: es una red, no una excusa.
  - **Un 500 nunca cuenta qué pasó adentro**: el mensaje real se loguea, hacia
    afuera va uno genérico (un error de Mongoose trae la consulta y la colección).
  - Los mensajes van en castellano y describen lo que pasó desde el lado de quien
    lee.
- **Config**: todo lo del entorno pasa por `config/app.config.ts` y
  `validateConfig()` corre **antes** de crear la app. No leas `process.env` desde
  un controller.
- **Consultor IA** (`services/project-advisor.service.ts`, `@anthropic-ai/sdk`):
  chat sobre los datos de **una** obra. Cada herramienta lleva el `projectId`
  cerrado en su closure —el modelo no lo elige— y la autorización ya la resolvieron
  `requireProjectAccess` y la capacidad `advisor.use`. Las cifras de plata que
  recibe siguen la sección Plata. Sin `ANTHROPIC_API_KEY` queda deshabilitado.
- **El orden del pipeline en `src/index.ts` no es arbitrario**: `trust proxy`
  antes del rate limit, el handler manual de `OPTIONS *` antes de `cors()`, y el
  `errorHandler` al final. Si movés algo, entendé por qué está ahí.

## Plata

Cobros y gastos se registran, con moneda, cotización y comprobante. Hay cuatro
cifras parecidas y **no se suman entre sí**:

| Cifra | Qué es | Dónde |
|---|---|---|
| Presupuestado | Lo que se planeó gastar | `Budget` |
| Comprometido | Lo cotizado en contrataciones aprobadas — tiene dueño, no salió | `commitment.service.ts` |
| Gastado | Lo que salió, con fecha y comprobante | `Expense` |
| Cobrado | Lo que entró del cliente | `Payment` |

Un adelanto a un proveedor está en "comprometido" y en "gastado": sumarlas cuenta
la misma plata dos veces. Tres reglas que no se negocian:

1. **Nada derivado se guarda.** Saldos, estado de cada cuota y margen se
   recalculan siempre en `finance.service.ts`.
2. **Cada movimiento lleva su moneda y su cotización, congeladas.** Un gasto de
   agosto vale lo que valía en agosto; reconvertir con la cotización de hoy haría
   cambiar solo el total de una obra cerrada.
3. **Cobros y gastos van por rutas separadas.** `payment.*` lo ve el cliente,
   `expense.*` no. Con los dos totales, el margen del ejecutante sale de una
   resta: si una ruta de gastos queda con `payment.read`, el cliente lo calcula
   con un `curl`.

Los cobros **no se editan**, sólo se crean o se borran: un cobro es un hecho con
fecha.

## Correos

Todos salen de `EmailService` con la plantilla única de `email-layout.ts` (guía:
`docs/CORREOS.md`). Un correo nunca lanza ni voltea la acción que lo dispara; si
quien llama no necesita saber si salió, no lo espera (`void`). Texto de la base
siempre con `escapeHtml()`. Un correo nuevo se suma a `src/scripts/email-preview.ts`.

## Suscripción

Lo que paga el dueño de una Empresa por usar Luma. **No se cruza nunca con los
cobros de una obra.** Planes y cómo probar en local: `docs/SUSCRIPCION.md`.

- Los números de los planes viven en `PLAN` (`packages/shared/src/billing/index.ts`);
  la landing los repite en `pricing.*` y se cambian juntos.
- **Las reglas viven en `@luma/shared/billing`**, puras y con tests. La API lee
  hechos de la base y le pregunta a shared; la UI muestra lo que la API resolvió.
  Un `if` sobre días de prueba o cantidad de obras fuera de shared va en shared.
- Mismo criterio que la plata de obra: nada derivado se guarda, y cada pago
  congela su desglose y su tasa BCV.
- **Vencida = sólo lectura**, resuelto en un solo lugar: `requireProjectAccess`
  recorta las capacidades a las `.read` según la Empresa **dueña de la obra**. No
  agregues chequeos de suscripción en los controllers.
- **Pagos**: tarjeta por Stripe Checkout embebido o bolívares a la tasa BCV con
  aprobación manual de un admin de plataforma. El webhook es la fuente de verdad;
  Stripe.js se carga a mano desde `lib/stripe-js.ts`, sin paquetes npm. La tasa la
  lee una tarea programada, nunca un request de usuario.
- Los avisos por mail (`subscription-notify.service.ts`) nunca hacen fallar la
  acción que los dispara.

## Frontend — llamadas a la API

**Ningún componente importa `apiClient`.** Dos capas, siempre:

```ts
// src/api/auth.ts — capa 1: habla con la API y desempaqueta el sobre
me: () => unwrap<{ user: AuthUser }>(apiClient.get('/api/auth/me')),

// src/hooks/auth/use-auth-queries.ts — capa 2: caché, dedup, estados
export function useCurrentUser() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: [QueryKeys.currentUser],
    queryFn: () => authApi.me(),
    enabled: isAuthenticated, // ← obligatorio en toda query protegida
  });
}
```

- `useQuery` para lecturas; `useMutation` para escrituras y acciones de la persona.
- Toda clave nueva va al enum `QueryKeys` en `src/lib/query-keys.ts`.
- **`enabled: isAuthenticated` es obligatorio** en toda query contra un endpoint
  protegido: los providers corren también en pantallas públicas, y un 401 ahí
  patea a `/login` rompiendo el flujo. Las llamadas públicas van con `skipAuth: true`.
- Rutas públicas que nunca reciben un redirect por 401: `/login`, `/register`,
  `/forgot-password`, `/reset-password`, `/check-email`, `/verify-email`,
  `/activate`, `/confirm-email-change`.

## Errores en la UI

Un solo canal por tipo de aviso, y un solo lugar que arma el texto.

- **Falla al guardar → banner** en el formulario (`FormShell`), nunca un toast.
- **Éxito → toast.** Verde, y nada más.
- **Falla sin formulario detrás** (un borrar, un cambio inline) → toast.

El texto lo resuelve `lib/error-message.ts` y nadie más. Gana el mensaje del
servidor, porque sabe cosas que el cliente no; el mapa por `code` es el fallback.
Si ves un `errorMessage` local en un hook, es de antes.

## Estilos

**La fuente de verdad es `DESIGN.md`** (tokens, radios, tipografía, componentes,
la paleta propia del Tablero). Ante cualquier contradicción, manda `DESIGN.md`. Hay
un solo sistema, **VoltAgent**: canvas `#101010` y un único verde `#00d992`; el
chrome del panel es oscuro y el área de contenido, clara (`.surface-light`). Si ves
`bg-cream`, `brand-fill`, `sunshine-*` o `#fa520f`, es un resto.

- **Tailwind v4**: no hay `tailwind.config.js`; los tokens viven en
  `packages/web/src/index.css` y `packages/landing/src/index.css`.
- Clases siempre con `cn()` de `@/lib/utils`.
- **shadcn/ui**: `components/ui/` no se edita; se extiende por `className` o se
  envuelve. Excepción: un cambio del sistema que tiene que vivir en el componente.
- **Tokens semánticos, no colores crudos**: `bg-background`, `bg-card`,
  `text-muted-foreground`, `bg-primary text-primary-foreground` (texto sobre el
  verde: `#101010`, nunca blanco). `destructive` es peligro, no marca.
- **Radio**: botones, buscador y pestañas `rounded-md`; Card `rounded-3xl`;
  `rounded-full` sólo para Badge, Avatar, Switch, Slider y Progress. El `Button` ya
  trae su radio y su sombra: no le pases `rounded-*` ni `shadow-*`. **El hijo va un
  escalón abajo del padre.** Un buscador es `SearchField`, no un `Input` con lupa.
  Todo `TabsTrigger` lleva ícono. La landing usa `CTA_PRIMARY` / `CTA_OUTLINE`
  (`src/lib/cta.ts`) en píldora. Tabla completa en `DESIGN.md`.
- **Tipografía**: `Inter` + `JetBrains Mono`; `Instrument Serif` sólo en el título
  de cada pantalla (`PageHeader`) y en `h1`/`h2` de la landing. Peso 400, sin
  negrita. Piso de 11px (`text-2xs`), siempre en `rem`.

## Arquitectura de la información

Qué va dónde en una pantalla del panel vive en
`docs/design/arquitectura-de-informacion.md` y manda junto con `DESIGN.md`. Lo que
más se rompe:

- **Pantalla**: sin título propio; una primaria flotante (`PageLayout action`);
  segundo orden y exportar en `secondaryActions`; pestañas y filtros en `toolbar`.
- **Lista**: cada fila es su tarjeta (`RowCard`) sobre el lienzo; los grupos,
  `ListSection` (rótulo + divisor), nunca otra caja. Nada de `divide-y`.
- **Fila**: línea 1 = qué es; línea 2 = `text-xs` muted, datos separados por
  `" · "` en orden fijo; estado como badge en columna fija.
- **Acciones por fila**: una visible (el paso siguiente) y el resto en "…"; todo
  destructivo va en el menú y con `AlertDialog`.
- **Textos y grupos**: nada repite lo que la UI ya dice.

## i18n — obligatorio

Ningún string visible se escribe inline en el JSX: `t('layout.emptyHomeTitle')`.

- `packages/web`: `src/i18n/locales/{es,es-ES,pt}/translation.json` (`es-AR`
  default; `es-ES` es el español de España: tuteo y vocabulario peninsular —
  "jefe de obra", "contable", "añadir", "justificante").
- `packages/landing`: `src/i18n/locales/{es,pt}/translation.json` (`es` default).
- **Toda clave nueva va a TODOS los archivos de su paquete al mismo tiempo.** Hay
  un test de paridad en CI.
- Para arrays: `t('key', { returnObjects: true }) as string[]`.

## Cross-browsing — obligatorio

Escribimos en Chrome, pero en un iPhone *todo* browser es Safari por dentro, y una
API que falta ahí no degrada la pantalla: la voltea entera. Las reglas se cumplen
**al escribir el código**; los E2E corren sólo en Chromium (no se instalan otros
motores).

**Nunca leas un global del browser como identificador suelto.** `?.` protege contra
`null`, no contra un binding que no existe: tira `ReferenceError`.

```ts
// ❌ Rompe en Safari
const id = requestIdleCallback?.(load) ?? window.setTimeout(load, 1500);
// ✅ Property access sobre `window`
const idle = typeof window.requestIdleCallback === 'function';
const id = idle ? window.requestIdleCallback(load) : window.setTimeout(load, 1500);
```

Antes de usar una API del browser verificá su soporte en Safari/iOS y escribí el
fallback **en el mismo commit**, detectando con `typeof window.X === 'function'`,
nunca con user-agent.

- **Fechas**: `new Date('2026-08-13 10:00')` da `Invalid Date` en Safari. Siempre
  ISO 8601 con `T`; un día suelto es `YYYY-MM-DD` como string, no `Date`.
- **CSS**: `100vh` en iOS incluye la barra; usá `100dvh`.
- Una feature nueva no está terminada hasta que carga sin errores de consola en
  Chromium.

## Tests

- **Unit** al lado del archivo (`src/lib/utils.spec.ts`), con `pnpm test`. El test
  de paridad i18n corre ahí.
- **E2E** en `/e2e` (raíz), con `pnpm test:e2e:ci`, **por flujo que una persona
  recorre**, no por endpoint; un endpoint nuevo se cubre con unit en la API.
- `e2e/global-setup.ts` detecta si no hay backend. **Un spec que necesita la API
  llama a `requiresApi()`** (`e2e/helpers/api.ts`) arriba del `test.describe`: CI
  corre sin backend y sin esa llamada el spec falla esperando el login.
- Login: helpers de `e2e/helpers/auth.ts`, nunca a mano.
- **`landing` no tiene script de `test`**: `pnpm -r test` lo saltea en silencio.

### Cuentas fijas de E2E

Una por tipo de usuario, definidas **sólo** en `e2e/fixtures/users.json`
(`admin`, `user`, `gerente`, `supervisor`, `contador`, `cliente`, `inactive`). Para
ejecutar E2E —o entrar a mano con un rol— se usan esas.

- El `globalSetup` las siembra solo (`pnpm seed:e2e`, idempotente) y guarda una
  sesión por cuenta en `.auth/<clave>.json`. `E2E_SKIP_SEED=1` lo saltea.
- En un spec: `test.use({ storageState: authFile('supervisor') })` o
  `loginAs(page, 'cliente')`. **Nunca** escribas email y contraseña de una cuenta
  fija: se piden por clave (`helpers/users.ts`).
- La obra compartida (`Obra E2E — roles`) es para **mirar**. Un spec que crea,
  mueve o borra arma su propia obra.
- Un tipo de usuario nuevo = una entrada en el JSON y la clave en `E2EUserKey`.
- Otro entorno: `E2E_<CLAVE>_EMAIL` / `E2E_<CLAVE>_PASSWORD`. El seed sólo toca
  cuentas `.test` y sólo en una base local.

## Multimedia — skill `media-gen`

**Todo pedido de imagen, video o audio se resuelve con `media-gen`**
(`.claude/skills/media-gen`, uso en su `SKILL.md`). No uses `claude-banana` ni
otro generador, y no llames a la API a mano.

- El skill es un **symlink local** (no se commitea) y la key va en
  `.claude/settings.local.json` → `env.GEMINI_API_KEY`. Nunca la pidas por el
  chat ni la escribas en un archivo que se commitea.
- **Salida dentro del paquete que la usa**: SPA en `packages/web/public/<sección>/`,
  landing en `packages/landing/src/assets/images/`. Siempre WebP, con
  `--width/--height` de lo que la pantalla muestra y `--max-kb`.
- **Costo**: el script estima antes de gastar y exige `--yes` si pasa de USD 0,50.
  Mostrale el número al usuario y esperá su OK; nunca pases `--yes` por tu cuenta.
- **Texto dentro de la imagen**: `--model gemini-3-pro-image`, frases de ≤ 25
  caracteres y todo el bloque en el 60% central del ancho. Queda en un solo
  idioma: si el texto cambia por locale, va en HTML.
- Desktop y mobile son dos generaciones con su propio formato, no un recorte.

## Cómo está configurado Claude acá

Este archivo es el contexto; `.claude/` es lo que lo hace ejecutable.

- **`settings.json`**: los scripts del repo y los comandos de lectura no piden
  aprobación; deploy y el seed están denegados; `git push` está permitido y
  `pre-push-check.sh` lo frena hacia main o master. **Flujo: rama de feature + PR.**
- **Hooks**: `post-edit-check.sh` corre tras cada Edit/Write (paridad i18n, colores
  crudos, radios fuera de escala, CTA a escuadra, strings inline, `components/ui/`
  editado, `shared` sin rebuildear, credenciales de E2E a mano).
- **Comandos y agentes**: `/feature <qué>` implementa en el orden shared → api →
  capa 1 → capa 2 → UI → i18n. `criterio` es el agente de producto (sólo lectura):
  afila un pedido vago antes de codear; para revisar algo hecho, el diff va en el
  prompt.
- **Code review de un PR**: si el cambio toca una pantalla (`packages/web/src/pages`,
  `components` o la landing), quien revisa **deja evidencia en el PR**: una captura
  por pantalla modificada, tomada en Chromium con la cuenta fija del rol que la ve
  (`e2e/fixtures/users.json`) y, si el cambio es responsive, también en móvil. Cada
  captura dice qué pantalla es y con qué rol. Una pantalla que no se pudo capturar
  se lista aparte, con el motivo: no se da por revisada.
- **Skills**: `verify` es la secuencia de cierre (typecheck → lint → unit → e2e).
  `verification-before-completion`: no digas "listo", "arreglado" ni "pasa" sin haber
  corrido el comando que lo prueba y leído su salida. `systematic-debugging`: ante
  un bug, primero la causa raíz; nada de parches sueltos, y tras 3 arreglos fallidos
  se discute la arquitectura. `media-gen` es local (ver Multimedia).
- **`.mcp.json`**: MongoDB en lectura y Coolify con lectura y escritura
  (`COOLIFY_URL`, `COOLIFY_TOKEN`); ninguna de sus herramientas está en `allow`.

Si agregás una regla nueva a este archivo y se puede verificar con un grep,
agregala también al hook: una regla que sólo vive en prosa se afloja con la sesión.

## Deploy

Coolify sobre VPS: `app` (API + SPA) + `landing` (nginx interno) + `mongo`. Todo en
`docs/DEPLOY.md`, incluidas las dos trampas operativas (el network alias de la
landing y el redeploy obligatorio al cambiar env vars).

- **Todo cambio en `packages/web` sube la versión** con `pnpm bump:web
  <patch|minor|major>` (semver, sólo `packages/web/package.json`). Es lo que avisa a
  una pestaña abierta que hay un deploy nuevo.
- **Cambios de configuración (env vars, dominios, backups, tareas programadas,
  servicios, bases de datos…): usá primero el skill `~/.claude/skills/coolify-deploy`
  y el MCP de Coolify**, e inspeccioná el estado (list/get) antes de modificar. El
  MCP sólo conecta con `COOLIFY_URL` y `COOLIFY_TOKEN` en el entorno desde el que
  se abre Claude (si no, `Invalid URL`); el CLI del skill
  (`python3 ~/.claude/skills/coolify-deploy/scripts/coolify.py …`) lee su propio
  token y funciona igual. No edites la configuración de deploy por fuera de
  Coolify. Las herramientas destructivas siguen pidiendo aprobación.

## Notas

- **pnpm siempre.** Nunca `npm` ni `yarn`.
- Tipos compartidos desde `@luma/shared`. Íconos: Lucide React, no emojis.
