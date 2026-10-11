# Prompt — Generar la base de `luma-app` a partir de Pantera Negra

> Este archivo es un prompt ejecutable. Pegalo en una sesión nueva de Claude Code con
> acceso de lectura a `~/Documents/GitHub/pantera-negra-wep-app` y de escritura a
> `~/Documents/GitHub/luma-app`. Sirve también como registro de qué se copió y por qué.

---

## Objetivo

Construir la **base técnica** de una aplicación nueva reutilizando la infraestructura
ya probada de Pantera Negra: monorepo pnpm, sesión de usuario completa, conexión a
MongoDB, sistema de diseño, i18n y despliegue en Coolify sobre un VPS de Contabo.

La base tiene que:

1. Levantar en local con un comando.
2. Dejar entrar a un usuario (login, refresh silencioso, logout).
3. Mostrar un **home de administrador deliberadamente vacío**, con el chrome de
   navegación armado y nada de producto adentro.
4. Servir una **landing que es sólo estructura**: secciones placeholder, sin copy de
   producto, sin features reales.
5. Estar lista para desplegarse en Coolify con tres recursos: `app`, `landing`, `mongo`.

## Regla de oro

**Se copia infraestructura, nunca dominio.**

Si un archivo menciona `dojo`, `member` (como entidad de negocio), `rank`, `stripes`,
`activity`, `attendance`, `membership`, `payment`, `enrollment`, `announcement`,
`mercadopago`, `whatsapp`, `platform billing`, `scraper` o `push/VAPID` — **no se
copia**. Si el concepto está entremezclado dentro de un archivo que sí sirve, se
reescribe el archivo sin ese concepto.

No inventes funcionalidad de producto. No agregues entidades "por si acaso". El
dominio se define en otra conversación.

## Origen y destino

- **Origen (sólo lectura):** `/Users/iocevelasco/Documents/GitHub/pantera-negra-wep-app`
- **Destino:** `/Users/iocevelasco/Documents/GitHub/luma-app`

## Renombrados obligatorios

| En Pantera | En el proyecto nuevo |
|---|---|
| `@pantera-negra/shared` | `@luma/shared` |
| `pantera-negra-monorepo` | `luma-monorepo` |
| modelo `Member` | modelo `User` |
| `dojo_id` en el `JWTPayload` | **eliminado** (sin multi-tenant) |
| roles `superadmin/admin/professor/member` | `admin` \| `user` |
| `matflow.site` | `<DOMINIO>` (placeholder, en docs y defaults) |
| `X-Dojo-Slug`, `X-Dojo-ID` en `ALLOWED_HEADERS` | eliminados |

---

## 1. Raíz del monorepo

Copiar y adaptar: `pnpm-workspace.yaml`, `.dockerignore`, `Dockerfile` raíz,
`playwright.config.ts`, `e2e/global-setup.ts`, `e2e/helpers/auth.ts`,
`e2e/auth.spec.ts`, `e2e/routing.spec.ts`, `scripts/coolify-deploy.sh` (UUIDs a
placeholder), `scripts/mongo-backup.sh`, `.github/workflows/e2e.yml`, y un
`package.json` raíz con los scripts de Pantera apuntando a `@luma/*`.

**Detalles que no se pueden perder:**

- El `Dockerfile` raíz instala con `--prod=false` en el stage de build: sin devDeps no
  hay `tsc` y el build falla. El stage final copia `packages/web/dist` a
  `packages/api/public`.
- `playwright.config.ts` levanta `dev:web` (6173) y `dev:landing` (5174); CI corre
  **sólo chromium**, `test:e2e:cross` corre chromium + webkit a mano. Firefox no se testea.

**Crear lo que en Pantera falta:** `eslint.config.js` (Pantera declara scripts `lint`
pero no tiene config), `.env.example` raíz completo, `.nvmrc`.

**No copiar:** `/tsconfig.json`, `/components.json`, `/styles/`, `/public/` de la raíz
(restos del scaffold de Next), ni `packages/mobile`.

## 2. `packages/shared` → `@luma/shared`

Sólo lo genérico:

- `src/types/index.ts`: `UserRole`, `JWTPayload` (sin `dojo_id`), `ApiResponse`,
  `LoginCredentials`, `RegisterCredentials`, `ForgotPasswordRequest`,
  `ResetPasswordRequest`, `AuthResponse`, `AuthUserResponse`.
- `src/schemas/index.ts`: los schemas zod correspondientes.
- `src/utils/environment.ts` completo, con su spec.

`package.json`: `type: module`, `exports` con `types` + `default`, única dependencia
`zod`. Todos los scripts de dev y build del root buildean `shared` **primero** —
`api` y `web` lo importan por nombre de paquete contra `dist`.

## 3. `packages/api`

### Se copia sin cambios

| Archivo | Por qué |
|---|---|
| `config/database.ts` | reintentos (5 × 5s), password enmascarada en logs, detección del error de IP whitelist de Atlas |
| `middleware/errorHandler.ts` | contrato uniforme `{ success:false, error, details?, code? }`; mapea ZodError/CastError/duplicate-key |
| `services/jwt.service.ts` | HS256 si hay `JWT_SECRET`, si no RS256 por PEM; un access token con `type:'refresh'` se rechaza |
| `services/email-layout.ts` | `renderEmailLayout`, `escapeHtml` |
| `services/recaptcha.service.ts` | reCAPTCHA v3, threshold 0.5 |
| `utils/app-url.ts`, `utils/date.ts` | los links de email se arman sobre `APP_URL`, que incluye el subpath `/app` |
| `scripts/generate-jwt-keys.sh` | |

### Se adapta

**`src/index.ts`** — conservar el orden exacto del pipeline, que no es arbitrario:

1. `validateConfig()` **antes** de crear la app.
2. `app.set('trust proxy', 1)` — sin esto el rate limit ve la IP de Traefik.
3. `isOriginAllowed(origin)` — whitelist + cualquier `http://localhost:*` en dev,
   normalizando la barra final.
4. Handler manual de `app.options('*')` con una constante única `ALLOWED_HEADERS`.
5. Redirect 301 `www.` → apex, sólo en producción.
6. `helmet` (CSP explícita en producción, `false` en dev).
7. `compression()`.
8. `cors({ credentials: true, maxAge: 86400 })`.
9. `express.json()`, `urlencoded()`, `cookieParser()`.
10. `GET /health` → `{ status, timestamp, database }`.
11. Routers.
12. Bloque `isProduction`: `app.use('/home', createProxyMiddleware({ target: LANDING_URL, changeOrigin: true, pathRewrite: { '^': '/home' } }))` (Express quita el prefijo, el rewrite lo repone), `GET /` → `301 /home`, `express.static` en `/app` buscando `public/` en varias rutas candidatas, fallback SPA `GET /app/*` → `index.html`, y la lista de rutas del SPA pedidas en la raíz que redirigen a `${spaMount}${originalUrl}`.
13. `errorHandler` **al final**.
14. `startServer()`: `listen` primero, `connectDatabase()` después (no bloqueante).
    `SIGTERM`/`SIGINT` con shutdown limpio.

Quitar: `enforcePlatformBilling`, `SchedulerService`, headers `X-Dojo-*`.

**`config/app.config.ts`** — dejar `SERVER_CONFIG` (con `APP_URL`), `CORS_CONFIG`,
`DATABASE_CONFIG`, `JWT_CONFIG`, `RECAPTCHA_CONFIG`, `EMAIL_CONFIG`, `isProduction` /
`isDevelopment`. Borrar Cloudinary, VAPID, WhatsApp, Anthropic, billing, scraper y los
feature flags encadenados. `validateConfig()` **con zod**, no con chequeos a mano como
en Pantera.

**`middleware/auth.middleware.ts` + `utils/roles.ts`** — `parseBearerToken`,
`isAuthenticated`, `requireAdmin`, `requireRole`. Roles `admin | user`.

**`models/User.ts`** — nuevo, destilado de `Member` sin nada de negocio:
`email` (unique, lowercase), `email_verified`, `name`, `picture`,
`password` (`select:false`), `role`, `resetToken`/`resetTokenExpires`,
`emailVerificationToken(+Expires)`, `pendingEmail`/`emailChangeToken(+Expires)`
(todos `select:false`), `enabled`, `account_status` + `deactivated_at`/`deactivated_by`
(soft delete), `timestamps: true`.

**`routes/auth.ts` + `controllers/auth.controller.ts`** — reescribir el controller de
Pantera (981 líneas con lógica de dojo entremezclada) quedándose con:

| Método + path | Guard |
|---|---|
| POST `/login` | limiter |
| POST `/register` | limiter |
| POST `/refresh` | limiter |
| POST `/logout` | `isAuthenticated` |
| GET `/me` | `isAuthenticated` |
| POST `/forgot-password` | limiter |
| POST `/reset-password` | limiter |
| POST `/set-password` | limiter |
| GET `/verify-email?token=` | — |
| POST `/resend-verification` | limiter |
| POST `/change-password` | `isAuthenticated` |
| POST `/change-email` | `isAuthenticated` |
| GET `/confirm-email-change?token=` | — |

Dos cosas que se copian textualmente:

- `setRefreshTokenCookie(res, token)` → cookie **`refresh_token`, `httpOnly: true`,
  `secure: isProduction`, `sameSite: 'lax'`, `maxAge` 90 días**.
- `authLimiter`: 15 min / 10 req **sólo en producción**. En desarrollo es passthrough,
  si no rompe los E2E.

**`services/auth.service.ts`** — sólo `generateTokens(userId, email)`.

**`services/email.service.ts`** — sólo activación de cuenta, verificación de email,
reset de password y confirmación de cambio de email.

**`scripts/seed-admin.ts`** — derivado de `seed-superadmin.ts`; crea el primer admin
desde `ADMIN_EMAIL` / `ADMIN_PASSWORD`. En producción se corre **compilado**
(`node dist/scripts/seed-admin.js`): la imagen final no tiene `src/` ni `tsx`.

**No copiar:** los 17 modelos de negocio, los 24 routers de negocio, los 22 servicios
restantes, `billing-enforcement.middleware.ts`, `lib/encryption.ts`, `cloudinary`,
`node-cron`, `@anthropic-ai/sdk`, ni los `.pem` de dev.

## 4. `packages/web`

### Se copia tal cual

- Los 58 componentes de `src/components/ui/` (shadcn/ui New York + Radix).
- `src/index.css` completo: los tres scopes de tokens, `--radius: 1rem`, el bloque
  `@theme inline`, las fuentes DM Sans / Noto Serif / DM Mono, `@custom-variant dark`.
  **Se conserva la escala de radius y sus dos reglas** (píldora = se toca, radio de la
  escala = superficie; el hijo va un escalón abajo del padre).
- `src/lib/api-client.ts` — el archivo más valioso. Conserva: `ApiError` con
  `status`/`code`/`data`, `PUBLIC_ROUTE_PREFIXES` derivado de `ROUTES` (un 401 en ruta
  pública **no** desloguea), el **refresh single-flight** (un 401 con token dispara un
  solo `POST /api/auth/refresh` —la cookie httpOnly viaja sola— y reintenta la request
  original; sólo si eso falla se cierra sesión), y los handlers inyectables
  `setUnauthorizedHandler` / `setTokenRefreshedHandler` para navegar por React Router
  en vez de `window.location`.
- `src/lib/{jwt-utils,return-to,utils,version-manager,service-worker-registration}.ts`
  con sus specs.
- `src/providers/auth-provider.tsx` — tope duro de sesión de 30 días, chequeo del `exp`
  del JWT, claves de localStorage `auth_token` / `auth_user` / `session_start_time`.
- `src/components/{error-boundary,theme-provider,update-notification,app-logo}.tsx`,
  `components/common/*`, `components/routes/*`.
- `src/i18n/config.ts` + el spec de paridad de claves entre locales.
- `vite.config.ts`: `base: '/app/'` sólo en producción, alias `@` → `src`,
  `dedupe: ['react','react-dom']`, `optimizeDeps.exclude: ['@luma/shared']`, proxy
  `/api` → `VITE_API_BASE_URL` en dev, `build.sourcemap: true`.

### Se adapta

- **`src/lib/routes.ts`** — `ROUTES` sólo con `/login`, `/register`,
  `/forgot-password`, `/reset-password`, `/check-email`, `/verify-email`, `/activate`,
  `/confirm-email-change`, `/admin`, `/admin/settings/account`, `*`.
- **`src/lib/query-keys.ts`** — `enum QueryKeys` reducido a `currentUser`.
- **`src/routes.tsx` + `components/route-layouts.tsx`** — guards `PublicOnlyLayout`
  (redirige por rol honrando `returnTo`), `AuthenticatedLayout` (→ login con
  `buildLoginPathWithReturn`), `AdminLayout`. Todas las páginas en `React.lazy` con
  `Suspense` + `RouteLoading`. Catch-all 404.
- **`src/providers/app-provider.tsx`** — `ThemeProvider` (next-themes,
  `attribute="class"`, default dark) → `AuthProvider` → `QueryClientProvider`
  (`retry: 1`, `staleTime: 5min`). En Pantera el QueryClient vive dentro de
  `MembersProvider`, que es un accidente histórico: acá va suelto.
- **Páginas de auth**: `login`, `register`, `forgot-password`, `reset-password`,
  `check-email`, `verify-email`, `activate`, `confirm-email-change`,
  `account-settings`, `not-found`, con sus componentes de `components/auth/*`
  (`auth-layout`, `login-form`, `register-form`, `forgot-password-form`).
- **`pages/admin-home.tsx`** — la home vacía. `DashboardLayout` con header, riel
  lateral en desktop y bottom-nav en móvil, alimentados por un único
  `dashboard-destinations.ts` con **un solo destino: Inicio**. En el contenido, un
  `EmptyState` con copy traducido del tipo "Acá va tu producto".
- **`src/api/auth.ts` + `src/hooks/auth/*`** — el patrón obligatorio de dos capas:
  función que llama a `apiClient` en `src/api/*`, hook de TanStack Query en
  `src/hooks/**`. **Ningún componente importa `apiClient`.** Toda `useQuery` contra un
  endpoint protegido lleva `enabled: isAuthenticated`; las llamadas de rutas públicas
  pasan `skipAuth: true`.
- **`src/i18n/locales/{es,pt}/translation.json`** — namespaces `common`, `auth`,
  `layout`, `userMenu`. Cada clave existe en **los dos** archivos, siempre.

**No copiar:** los 23 módulos de `src/api/` de negocio, las ~30 carpetas de hooks de
dominio, los stores de zustand de negocio, el área del alumno completa, y las páginas
de dashboard/contabilidad.

## 5. `packages/landing`

Misma estructura que la landing de Pantera, sin su copy. Vite + React 19 + Tailwind v4
+ i18next, `base: '/home'`, puerto 5174, dependencias mínimas (react, react-dom,
i18next, react-i18next, i18next-browser-languagedetector, lucide-react).

Secciones: `Nav` (con selector de idioma), `Hero`, `Features` (tres tarjetas
placeholder), `FinalCTA` con link a `${VITE_APP_URL}/login`, `Footer`. **Todo** el
texto vive en `locales/{es,pt}/translation.json`, con copy neutro y sin producto.

`Dockerfile` propio, con **contexto en la raíz del repo**: copia `pnpm-lock.yaml`,
`pnpm-workspace.yaml` y **todos** los `package.json` de los paquetes — con
`--frozen-lockfile`, si falta uno, aborta. Build con `VITE_APP_URL` como ARG. Stage
final `nginx:alpine` con el `default.conf` de Pantera: puerto 8080, gzip,
`/home/assets/` con `Cache-Control: immutable`, `/home` → `try_files` → `index.html`,
`location = /` → `301 /home`, `location = /login` → `301 /app/login`, catch-all 404.

## 6. Despliegue — `docs/DEPLOY.md`

Topología (una sola puerta a internet):

```
Traefik (:443, lo pone Coolify)
  └── app :8080 (Express)   /api/*   API
                            /app/*   SPA desde packages/api/public
                            /home/*  → proxy por la red interna de Docker
                               └── landing :8080 (nginx, sin dominio)
      mongo :27017 (sin puerto público)
```

Configuración por recurso en Coolify:

| Recurso | Build Pack | Base Directory | Dockerfile | Expone | Dominio |
|---|---|---|---|---|---|
| `app` | Dockerfile | `/` | `/Dockerfile` | 8080 | `https://<DOMINIO>`, Health Check `/health` |
| `landing` | Dockerfile | `/` | `/packages/landing/Dockerfile` | 8080 | **vacío**, network alias `landing` |
| `mongo` | recurso MongoDB 8 | — | — | 27017 | sin puerto público, alias `mongo` |

Dos trampas operativas que hay que dejar escritas: el alias de red de `landing` se fija
**antes del primer deploy** (si no, el hostname es aleatorio y el proxy no lo
encuentra), y cambiar dominio, alias o variables de entorno **exige redesplegar**,
porque se escriben como labels de Docker al crear el contenedor.

Variables de entorno del servicio `app`: `NODE_ENV`, `PORT`, `HOST`, `MONGODB_URI`,
`JWT_SECRET`, `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`, `RECAPTCHA_SECRET_KEY`,
`FRONTEND_URL`, `APP_URL` (**con el subpath `/app`**), `ALLOWED_ORIGINS`,
`LANDING_URL` (`http://landing:8080`), `RESEND_API_KEY`, `EMAIL_FROM`, `APP_NAME`,
`ADMIN_EMAIL`, `ADMIN_PASSWORD`. Build args: `VITE_RECAPTCHA_SITE_KEY` en `app`,
`VITE_APP_URL` en `landing`.

## 7. `CLAUDE.md` del proyecto nuevo

Reescribir el de Pantera quedándose con lo que sigue aplicando: el patrón de llamadas
a la API en dos capas, `enabled: isAuthenticated`, la escala única de `--radius` con
sus dos reglas, las convenciones de Tailwind v4 y shadcn/ui, i18n obligatorio en ambos
paquetes, y la sección de cross-browsing (no leer globals del browser como
identificador suelto — `foo?.()` sobre un global ausente tira `ReferenceError`; usar
`window.foo`; fechas siempre ISO con `T` por Safari). Fuera todo lo del área del
alumno y del dominio de dojos.

---

## Criterios de aceptación

```bash
pnpm install
pnpm typecheck    # los 4 paquetes, limpio
pnpm lint
pnpm build        # shared → api → web → landing
```

1. `pnpm dev` levanta api + web; `pnpm dev:landing` levanta la landing.
2. `seed-admin` crea el primer admin y el login funciona de punta a punta.
3. `/admin` muestra la home vacía con la navegación armada.
4. Borrando `auth_token` de localStorage pero dejando la cookie, una recarga produce
   **un solo** `POST /api/auth/refresh` seguido del reintento de la request original.
5. `curl localhost:8080/health` responde `{ status, timestamp, database }`.
6. La landing carga sin errores de consola en chromium y webkit.
7. `docker build` de los dos Dockerfiles compila.
8. No queda ninguna referencia a dojo, member, rank, attendance, membership, payment,
   mercadopago, whatsapp ni billing en todo el repo.
