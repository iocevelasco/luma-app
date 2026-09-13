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
- **Roles**: `admin` y `user`. Middlewares: `isAuthenticated` → `requireAdmin` |
  `requireRole`.
- **Baja lógica**: `account_status: 'inactive'` + `enabled: false`. Nunca se borra
  el documento.
- **Errores**: todo sale por `errorHandler` con la forma
  `{ success: false, error, details?, code? }`. Las respuestas exitosas son
  `{ success: true, data }`.
- **Config**: todo lo del entorno pasa por `config/app.config.ts` y `validateConfig()`
  corre **antes** de crear la app. No leas `process.env` desde un controller.
- **El orden del pipeline en `src/index.ts` no es arbitrario.** `trust proxy` antes
  del rate limit, el handler manual de `OPTIONS *` antes de `cors()`, y el
  `errorHandler` al final. Si movés algo de lugar, entendé por qué está ahí.

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

- **Tailwind v4**: no hay `tailwind.config.js`. Los tokens viven en
  `packages/web/src/index.css` dentro de `@theme`.
- **Composición de clases**: siempre `cn()` de `@/lib/utils`.
- **shadcn/ui**: los componentes de `components/ui/` no se editan. Se extienden por
  `className` o se envuelven.
- **Tokens semánticos, no colores crudos**: `bg-background`, `text-muted-foreground`,
  `bg-primary`. Un `bg-[#EF233C]` saltea el tema.

### Radio — una sola escala

Todo el redondeo sale de `--radius` (16px) en `index.css`. **No agregues valores
nuevos ni radios arbitrarios.**

| Clase | Valor | Se usa en |
|---|---|---|
| `rounded-full` | píldora | **Todo control**: Button, Badge, chips, tabs, avatares |
| `rounded-lg` | 16px | **Superficie**: Card, Dialog, Popover, Dropdown, Toast |
| `rounded-md` | 12px | **Anidado**: Input, Select, Textarea, filas dentro de una Card |
| `rounded-xl` | 20px | Contenedor que envuelve superficies |
| `rounded-2xl` | 24px | Bottom sheet |
| `rounded-sm` / `rounded-xs` | 10 / 6px | Ítems de menú, indicadores |

Dos reglas:

1. **La forma dice qué es.** Píldora = se toca. Radio de la escala = es una
   superficie. Un botón nunca lleva `rounded-*` propio: `Button` ya es píldora.
2. **El hijo va un escalón abajo del padre.** Una fila `rounded-md` dentro de una
   Card `rounded-lg`. Un radio interno mayor que el del contenedor deja una luz
   visible en la esquina.

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

Toda feature se desarrolla pensando en Safari, Chrome y Firefox. Chrome es donde
escribimos el código, no donde vive el usuario: en un iPhone *todo* browser corre
sobre WebKit, y una API que falta ahí no degrada la pantalla, la voltea entera.

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
si falta en alguno de los tres escribí el fallback **en el mismo commit**. Detectá
con `typeof window.X === 'function'`, nunca con user-agent sniffing.

**Fechas**: Safari es estricto parseando. `new Date('2026-08-13 10:00')` da
`Invalid Date` en Safari y funciona en Chrome. Usá siempre ISO 8601 con `T`.

**CSS**: `100vh` en iOS incluye la barra del browser; usá `100dvh`.

### Verificación

```bash
pnpm exec playwright install webkit firefox   # una sola vez
pnpm test:e2e:ci                              # chromium — lo que corre CI
pnpm test:e2e:cross                           # los tres motores
```

CI corre **sólo chromium**: es la suite de regresión funcional y triplicarla no
encuentra tres veces más bugs. `test:e2e:cross` se corre a mano antes de mergear
una feature que toque una API del browser.

Una feature nueva no está terminada hasta que carga sin errores de consola en los
tres motores.

## Deploy

Coolify sobre VPS: `app` (API + SPA) + `landing` (nginx interno) + `mongo`. Todo
en `docs/DEPLOY.md`, incluidas las dos trampas operativas (el network alias de la
landing y el redeploy obligatorio al cambiar env vars).

## Notas

- **pnpm siempre.** Nunca `npm` ni `yarn`.
- Tipos compartidos desde `@luma/shared`.
- Íconos: Lucide React, no emojis ni otra librería.
