# Luma — Guía del proyecto

## Qué es esto

Base de aplicación: monorepo pnpm con API, SPA y landing. Tiene sesión de usuario
completa, sistema de diseño y despliegue resueltos, y **no tiene producto**. La
home del panel está vacía a propósito: ahí va la primera pantalla real cuando el
dominio esté definido.

No inventes entidades de negocio. Si una tarea necesita un modelo nuevo, preguntá
antes de crearlo.

## Paquetes

| Paquete | Qué es |
|---|---|
| `packages/api` | Node + Express 4 + Mongoose 8 + TypeScript ESM |
| `packages/web` | Vite 6 + React 19 + Tailwind v4 + shadcn/ui |
| `packages/landing` | Vite + React + i18next, estática, servida por nginx |
| `packages/shared` | Tipos + schemas Zod que comparten API y web |

```bash
pnpm dev          # api + web
pnpm dev:landing  # landing (5174)
pnpm build        # shared → api → web
pnpm typecheck    # los cuatro paquetes
pnpm lint
pnpm test         # unit (vitest)
pnpm test:e2e:ci  # E2E chromium
pnpm seed:admin   # primer usuario admin
```

`shared` se buildea **primero** en todos los scripts: `api` y `web` lo importan por
nombre de paquete contra su `dist`.

## Backend

- **Auth**: access token en `Authorization: Bearer`, refresh en cookie httpOnly
  `refresh_token` (90 días). HS256 si hay `JWT_SECRET`, si no RS256 con el par PEM.
- **Roles de plataforma**: `admin` y `user`. Middlewares: `isAuthenticated` →
  `requireAdmin` | `requireRole`. No gatean ninguna pantalla del producto.
- **Roles de obra**: `gerente` | `supervisor` | `cliente`, por obra y no por
  Empresa. El gerente sale de `Project.createdBy`; los otros dos son filas de
  `ProjectMembership`. **Quién puede qué vive en una sola grilla**:
  `packages/shared/src/permissions/index.ts`. Los routers declaran la acción
  con `requireCapability('activity.plan')` y los controllers preguntan con
  `req.can(...)` — nunca por rol. La UI lee `project.capabilities`, que la API
  ya resolvió; no la vuelve a derivar.
  Agregar un permiso = una celda en la grilla. Si estás escribiendo
  `role === 'supervisor'` en cualquier lado, estás en el camino equivocado.
- **Baja lógica**: `account_status: 'inactive'` + `enabled: false`. Nunca se borra
  el documento.
- **Errores**: toda respuesta de error tiene la forma
  `{ success: false, error, code, details? }`. Las exitosas son
  `{ success: true, data }`.
  - `code` es un `ApiErrorCode` de `@luma/shared` — estable, para la máquina.
    **El frontend ramifica por `code`, nunca comparando el texto**: el texto
    cambia cuando alguien edita un mensaje.
  - En código nuevo, **lanzá** el error: `throw notFound('No encontramos esa
    obra.')` desde `utils/errors.ts`. El `errorHandler` lo formatea. Un
    `return res.status(...)` arma la respuesta a mano y cada lugar elige su
    propio criterio — así llegamos a 221 de esas.
  - Los que quedan escritos a mano los cubre `normalizeErrors`, que completa
    el `code` a partir del status. Es una red, no una excusa.
  - **Un 500 nunca cuenta qué pasó adentro.** El mensaje real se loguea; hacia
    afuera va uno genérico. Un error de Mongoose trae la consulta y la
    colección.
  - Los mensajes van **en castellano** y describen lo que pasó desde el lado
    de quien lo lee.
- **Config**: todo lo del entorno pasa por `config/app.config.ts` y `validateConfig()`
  corre **antes** de crear la app. No leas `process.env` desde un controller.
- **El orden del pipeline en `src/index.ts` no es arbitrario.** `trust proxy` antes
  del rate limit, el handler manual de `OPTIONS *` antes de `cors()`, y el
  `errorHandler` al final. Si movés algo de lugar, entendé por qué está ahí.

## Errores en la UI

Un solo canal por tipo de aviso, y un solo lugar que arma el texto.

- **Falla al guardar → banner** en el formulario, nunca un toast. `FormShell`
  lo muestra pegado al botón que la persona acaba de apretar; un toast sale en
  la esquina opuesta de la pantalla.
- **Éxito → toast.** Verde, y nada más.
- **Falla sin formulario detrás** —un borrar, un cambio inline— sí va por
  toast: no hay dónde poner un banner.

El texto lo resuelve `lib/error-message.ts` y nadie más. Gana el mensaje del
servidor, porque sabe cosas que el cliente no puede saber ("esa cuota ya tiene
cobros registrados"); el mapa por `code` es el fallback. Si ves un
`errorMessage` local en un hook, es de antes — hay uno solo.

## Plata

La regla 8 del documento funcional decía que la app no registraba pagos. **Eso
ya no vale**: desde el módulo de cobros y gastos sí se registran, con moneda,
cotización y comprobante. Si encontrás un comentario que diga lo contrario,
está viejo — arreglalo.

Lo que la regla protegía sigue en pie, y ahora importa más porque hay cuatro
cifras parecidas conviviendo. No son lo mismo y **no se suman entre sí**:

| Cifra | Qué es | Dónde |
|---|---|---|
| Presupuestado | Lo que se planeó gastar | `Budget` |
| Comprometido | Lo cotizado en contrataciones aprobadas — tiene dueño, no salió | `commitment.service.ts` |
| Gastado | Lo que salió, con fecha y comprobante | `Expense` |
| Cobrado | Lo que entró del cliente | `Payment` |

Un adelanto a un proveedor está en "comprometido" y en "gastado": sumarlas
cuenta la misma plata dos veces.

Tres reglas que no se negocian:

1. **Nada derivado se guarda.** Saldos, estado de cada cuota y margen se
   recalculan siempre en `finance.service.ts`. Un saldo guardado es la garantía
   de que algún día no va a coincidir con la suma de sus movimientos, y cuando
   eso pase ninguno de los dos números sirve.
2. **Cada movimiento lleva su moneda y su cotización, congeladas.** Un gasto de
   agosto vale lo que valía en agosto. Reconvertir con la cotización de hoy
   haría que el total de una obra cerrada cambie solo.
3. **Cobros y gastos van por rutas separadas.** `payment.*` lo ve el cliente,
   `expense.*` no. Con los dos totales, la utilidad del ejecutante sale de una
   resta — la regla 13, que esa sí sigue vigente. Si una ruta de gastos queda
   con `payment.read`, el cliente puede calcular tu margen con un `curl`.

Los cobros **no se editan**, sólo se crean o se borran: un cobro es un hecho
con fecha, y corregirle el monto in situ deja el saldo cuadrando con una
historia que nadie vivió.

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

- `useQuery` para lecturas y efectos manejados por la URL; `useMutation` para
  escrituras y acciones que dispara la persona.
- Toda clave nueva va al enum `QueryKeys` en `src/lib/query-keys.ts`.
- **`enabled: isAuthenticated` es obligatorio** en cualquier query contra un endpoint
  protegido: los providers corren también en las pantallas públicas, y un 401 ahí
  dispara `handleUnauthorized` y patea a `/login` rompiendo el flujo.
- Las llamadas de pantallas públicas van con `skipAuth: true`.

Rutas públicas que nunca deben recibir un redirect por 401: `/login`, `/register`,
`/forgot-password`, `/reset-password`, `/check-email`, `/verify-email`,
`/activate`, `/confirm-email-change`.

## Estilos

**La fuente de verdad es `DESIGN.md` en la raíz.** Este bloque es el resumen
operativo; ante cualquier duda o contradicción, manda `DESIGN.md`.

Hay **un solo** sistema de diseño, **VoltAgent**: lienzo casi negro `#101010`,
un único verde `#00d992` como marca y como relleno de CTA. Landing, login y
chrome del panel son oscuros; el **área de contenido del panel es clara**
(`.surface-light`, ver `DESIGN.md`). Rige los dos paquetes con el mismo vocabulario de tokens y los mismos
valores. El rojo del panel, el "lenguaje de cero" de la landing y el sistema
naranja/crema que vino después ya no existen: si ves `bg-cream`, `brand-fill`,
`sunshine-*` o `#fa520f`, es un resto.

- **Tailwind v4**: no hay `tailwind.config.js`. Los tokens viven en
  `packages/web/src/index.css` (`:root` + `@theme inline`) y
  `packages/landing/src/index.css` (`@theme`).
- **Composición de clases**: siempre `cn()` de `@/lib/utils`.
- **shadcn/ui**: los componentes de `components/ui/` no se editan. Se extienden
  por `className` o se envuelven. La única excepción es un cambio del sistema que
  *tiene* que vivir en el componente — el radio o el color del `Button`.
- **Tokens semánticos, no colores crudos**: `bg-background`, `bg-card`,
  `text-muted-foreground`, `bg-primary`. Un `bg-[#00d992]` saltea el tema.

### Un solo verde

`#00d992` con texto `#101010` da ~10.3:1: pasa AA en cualquier tamaño, así que
**no hay que partir la marca en dos tokens** como pasaba con el naranja.

| Token | Para qué |
|---|---|
| `brand` / `primary` | Marca, relleno de CTA, foco, estado activo. El hex es el mismo; son dos nombres por rol |
| `primary-foreground` | Texto sobre el relleno: `#101010`, **nunca blanco** |
| `primary-pressed` | Hover y estado presionado |

Usá `bg-primary text-primary-foreground`. El rojo (`destructive`) significa
**peligro**, no marca.

### Radio — escala del panel

| Clase | Valor | Se usa en |
|---|---|---|
| `rounded-sm` | 6px | Input, Select, Textarea, ítems de menú |
| `rounded-md` | 8px | Code blocks, filas internas |
| `rounded-lg` | 14px | Dialog, menú, dropdown, toast |
| `rounded-xl` / `rounded-2xl` | 18 / 22px | Popover grande, panel destacado |
| `rounded-3xl` | **28px** | **Card** — el dominante |
| `rounded-xs` | 4px | Chips micro, indicadores |
| `rounded-full` | píldora | **Botones** (todas las variantes), Badge, Avatar, Switch, Slider, Progress |

Dos reglas:

1. **Los botones son píldora, y con relieve.** Al badge también lo es; lo que
   separa uno de otro es el volumen: `shadow-cta` en los rellenos,
   `shadow-raised` en el secundario, borde de 2px en el outline. El `Button`
   ya lo trae — no le pases `rounded-*` ni `shadow-*`. En la landing los CTA
   son links y usan `CTA_PRIMARY` / `CTA_OUTLINE` de `src/lib/cta.ts`.
2. **El hijo va un escalón abajo del padre.** Un Input `rounded-sm` dentro de una
   Card `rounded-3xl`. Un radio interno mayor que el del contenedor deja una luz
   visible en la esquina.

### Tipografía

`Inter` para todo lo narrativo y de interfaz, `JetBrains Mono` para código y
contadores. **`Instrument Serif` es el único serif y tiene un uso acotado**:

- **Panel**: sólo el título de cada pantalla (`PageHeader`, `font-serif`).
- **Landing**: `h1` y `h2`, el display. De `h3` para abajo es Inter. Ya se aplica
  en `@layer base`, no hace falta repetirlo en el JSX.

Peso 400, sin negrita. Las fuentes de la landing son self-hosted (woff2 latino,
salen con hash en `/home/assets`); no se piden a Google Fonts.

Piso de tamaño: 11px (`text-2xs`), y siempre en `rem`. Un `text-[10px]` en px no
responde al tamaño de texto del sistema operativo.

## i18n — obligatorio

Ningún string visible se escribe inline en el JSX.

```tsx
const { t } = useTranslation();
<p>{t('layout.emptyHomeTitle')}</p>
```

- `packages/web`: `src/i18n/locales/{es,pt}/translation.json` (`es-AR` default).
- `packages/landing`: `src/i18n/locales/{es,pt}/translation.json` (`es` default).
- **Toda clave nueva se agrega a los DOS archivos al mismo tiempo.** Hay un test de
  paridad que lo verifica en CI.
- Para arrays (listas, pasos): `t('key', { returnObjects: true }) as string[]`.

## Cross-browsing — obligatorio

Toda feature se desarrolla pensando en Chrome y en Safari. Chrome es donde
escribimos el código, no donde vive el usuario: en un iPhone *todo* browser corre
sobre WebKit, y una API que falta ahí no degrada la pantalla, la voltea entera.

**Firefox no se testea.** No es un olvido: Gecko casi nunca rompe algo que
Chromium y WebKit pasan los dos, y una tercera suite cuesta tiempo de CI y de
persona sin encontrar bugs proporcionales. Si algún día aparece un reporte real
de Firefox, se revisa la decisión.

### La regla que más rompe: nunca leas un global del browser como identificador suelto

```ts
// ❌ Rompe en Safari con ReferenceError
const id = requestIdleCallback?.(load) ?? window.setTimeout(load, 1500);

// ✅ Property access sobre `window` — devuelve undefined, no tira
const idle = typeof window.requestIdleCallback === 'function';
const id = idle ? window.requestIdleCallback(load) : window.setTimeout(load, 1500);
```

`?.` protege contra `null`/`undefined`, **no contra un binding que no existe en el
scope**: `foo?.()` sobre un global ausente tira `ReferenceError` antes de evaluar el
optional chaining. TypeScript no avisa — sus tipos de `lib.dom` declaran la API como
si siempre estuviera.

Antes de usar una API del browser: verificá el soporte en Safari (incluido iOS), y
si falta escribí el fallback **en el mismo commit**. Detectá con
`typeof window.X === 'function'`, nunca con user-agent sniffing.

**Fechas**: Safari es estricto parseando. `new Date('2026-08-13 10:00')` da
`Invalid Date` en Safari y funciona en Chrome. Usá siempre ISO 8601 con `T`.

**CSS**: `100vh` en iOS incluye la barra del browser; usá `100dvh`.

### Verificación

```bash
pnpm exec playwright install webkit   # una sola vez
pnpm test:e2e:ci                      # chromium — lo que corre CI
pnpm test:e2e:cross                   # chromium + webkit
```

CI corre **sólo chromium**: es la suite de regresión funcional y duplicarla no
encuentra el doble de bugs. `test:e2e:cross` se corre a mano antes de mergear una
feature que toque una API del browser.

Una feature nueva no está terminada hasta que carga sin errores de consola en
chromium y en webkit.

## Tests

| Tipo | Dónde | Corre con |
|---|---|---|
| Unit | Al lado del archivo: `src/lib/utils.spec.ts` | `pnpm test` (vitest) |
| Paridad i18n | `packages/web/src/i18n/i18n-parity.spec.ts` | `pnpm test` |
| E2E | `/e2e` en la raíz, no dentro de los paquetes | `pnpm test:e2e:ci` |

- `e2e/global-setup.ts` levanta la sesión y **detecta si no hay backend**: sin API
  corren igual los specs que no necesitan sesión, no revienta la suite.
- Los helpers de login viven en `e2e/helpers/auth.ts`. No escribas un login a mano
  en un spec nuevo.

### Cuentas fijas de E2E

Hay una cuenta por tipo de usuario, definidas en **`e2e/fixtures/users.json`** y
nada más que ahí. Para ejecutar E2E —o entrar a mano con un rol— se usan esas:

| Clave | Email | Qué es |
|---|---|---|
| `admin` | `e2e-admin@luma.test` | Admin de plataforma. Sesión por defecto de la suite |
| `user` | `e2e-user@luma.test` | Usuario sin obras: estado vacío |
| `gerente` | `e2e-gerente@luma.test` | Dueño de la obra compartida `Obra E2E — roles` |
| `supervisor` · `contador` · `cliente` | `e2e-<rol>@luma.test` | Su rol en esa obra |
| `inactive` | `e2e-inactive@luma.test` | Dada de baja: el login la rechaza |

- **Las siembra el `globalSetup` solo** antes de cada tanda local (`pnpm seed:e2e`
  por dentro, idempotente) y guarda una sesión por cuenta en `.auth/<clave>.json`.
  No hace falta correr nada antes de `pnpm test:e2e:ci`; sólo que la API esté
  arriba. `E2E_SKIP_SEED=1` lo saltea. Contra un entorno remoto no siembra.
- En un spec: `test.use({ storageState: authFile('supervisor') })` para arrancar
  logueado, o `loginAs(page, 'cliente')`. **Nunca** escribas email y contraseña
  de una cuenta fija en el spec: se piden por clave (`helpers/users.ts`).
- La obra compartida es para **mirar**: la ven todas las tandas. Un spec que
  crea, mueve o borra arma su propia obra.
- Un tipo de usuario nuevo = una entrada en el JSON (y la clave en
  `E2EUserKey`). El seed y los specs leen el mismo archivo.
- Para otro entorno, cada cuenta se pisa con `E2E_<CLAVE>_EMAIL` /
  `E2E_<CLAVE>_PASSWORD`. El seed sólo toca cuentas `.test` y sólo en una base
  local.
- **`landing` no tiene script de `test`.** `pnpm -r test` lo saltea en silencio: un
  cambio en la landing no está cubierto por unit tests, sólo por E2E.
- E2E se agrega por **flujo que una persona recorre**, no por endpoint. Un endpoint
  nuevo se cubre con unit en la API.

## Cómo está configurado Claude acá

Este archivo es el contexto; `.claude/` es lo que lo hace ejecutable.

| Pieza | Qué hace |
|---|---|
| `.claude/settings.json` | Permisos (los scripts del repo y los comandos de lectura no piden aprobación; deploy, `git push` y el seed están denegados) y el hook de post-edición |
| `.claude/hooks/post-edit-check.sh` | Corre después de cada Edit/Write: paridad i18n, colores crudos, radios fuera de escala, CTA a escuadra, strings inline, `components/ui/` editado, `shared` sin rebuildear, credenciales de E2E escritas a mano |
| `.claude/hooks/pre-push-check.sh` | Bloquea todo `git push` cuyo destino sea main o master. El flujo es rama de feature + PR, y una regla de permisos no puede expresar "salvo a main" |
| `.claude/skills/verify/` | La secuencia de cierre: typecheck → lint → unit → e2e, y cross-browser cuando corresponde |
| `.claude/commands/feature.md` | `/feature <qué>` — implementa respetando el orden shared → api → capa 1 → capa 2 → UI → i18n |
| `.claude/agents/criterio.md` | Agente de producto: afila un pedido vago en un encargo implementable y lo critica antes de que se escriba código |
| `.mcp.json` | MongoDB en modo lectura (`MONGODB_URI`) y Coolify con lectura y escritura (`COOLIFY_URL`, `COOLIFY_TOKEN`) — 111 herramientas, 24 destructivas; ninguna en `allow`, así que todas piden aprobación. Ver `docs/DEPLOY.md` |

Si agregás una regla nueva a este archivo y se puede verificar con un grep,
agregala también al hook. Una regla que sólo vive en prosa se cumple al principio
de la sesión y se afloja después.

## Deploy

Coolify sobre VPS: `app` (API + SPA) + `landing` (nginx interno) + `mongo`. Todo
en `docs/DEPLOY.md`, incluidas las dos trampas operativas (el network alias de la
landing y el redeploy obligatorio al cambiar env vars).

### Versión de la SPA

**Todo cambio en `packages/web` sube la versión** con `pnpm bump:web
<patch|minor|major>` — semver.org, sólo `packages/web/package.json`. Es lo que
le avisa a una pestaña abierta que hay un deploy nuevo (`/app/version.json` +
`UpdateNotification`). `buildTime` es la red si se olvida, no un reemplazo.
Detalle en `docs/DEPLOY.md`.

### Cambios de configuración: primero el skill de Coolify

Cuando se pida un cambio relacionado con la **configuración del proyecto** —
env vars, scopes, deploys, métricas, analytics, dominios del server, storages,
backups, tareas programadas, servicios, bases de datos, o cualquier otra cosa
que Coolify ofrezca— **usá siempre primero el skill `~/Documents/Claude/coolify-deploy`
y el MCP de Coolify** (`.mcp.json`), con todas sus capabilities, **antes de
ejecutar el cambio**.

- Leé `~/Documents/Claude/coolify-deploy/SKILL.md` (y `REFERENCE.md` si hace
  falta) para saber qué operación corresponde, y recién después actuá.
- Inspeccioná el estado actual (list/get) antes de modificar.
- No edites la configuración de deploy a mano ni por fuera de Coolify: si el
  cambio se puede hacer por el skill o el MCP, se hace por ahí.
- Las herramientas destructivas del MCP siguen pidiendo aprobación; el skill no
  la saltea.

## Notas

- **pnpm siempre.** Nunca `npm` ni `yarn`.
- Tipos compartidos desde `@luma/shared`.
- Íconos: Lucide React, no emojis ni otra librería.
