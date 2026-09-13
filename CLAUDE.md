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

**La fuente de verdad es `DESIGN.md` en la raíz.** Este bloque es el resumen
operativo; ante cualquier duda o contradicción, manda `DESIGN.md`.

Hay **un solo** sistema de diseño. El rojo `#EF233C` del panel y el "lenguaje de
cero" de la landing fueron reemplazados por uno editorial —naranja, crema,
serif de display— que rige los dos paquetes con el mismo vocabulario de tokens.

- **Tailwind v4**: no hay `tailwind.config.js`. Los tokens viven en
  `packages/web/src/index.css` y `packages/landing/src/index.css`, dentro de
  `@theme`.
- **Composición de clases**: siempre `cn()` de `@/lib/utils`.
- **shadcn/ui**: los componentes de `components/ui/` no se editan. Se extienden
  por `className` o se envuelven. La única excepción es un cambio del sistema que
  *tiene* que vivir en el componente — el radio o el color del `Button`.
- **Tokens semánticos, no colores crudos**: `bg-background`, `text-muted-foreground`,
  `bg-primary`, `bg-cream`. Un `bg-[#fa520f]` saltea el tema.

### El naranja va partido en dos

`#fa520f` con texto blanco encima da **3.34:1 y no pasa AA**. Es el valor de
marca de la referencia, y tomado literal como relleno deja cada CTA por debajo
del mínimo legible.

| Token | Para qué |
|---|---|
| `brand` | Tinta, ícono, borde, acento. **Nunca como relleno con texto encima.** |
| `primary` | Relleno de CTA. Ya resuelve el contraste por tema: en claro es naranja profundo con texto blanco (5.03:1), en oscuro es naranja saturado con texto tinta (4.93:1). |

El componente no decide el color del texto sobre el primario — lo resuelve el
token. Usá `bg-primary text-primary-foreground` y funciona en los dos temas.

El rojo ahora significa **peligro**, no marca: antes el CTA y el error eran el
mismo color.

### Radio — escala editorial

| Clase | Valor | Se usa en |
|---|---|---|
| `rounded-md` | **8px** | **Botones**, Input, Select, Textarea, code blocks |
| `rounded-lg` | **12px** | **Card**, Dialog, Popover, Dropdown, panel — el dominante |
| `rounded-xl` | 16px | Contenedor que envuelve cards |
| `rounded-2xl` | 20px | Card destacada, bottom sheet |
| `rounded-sm` / `rounded-xs` | 6 / 4px | Ítems de menú, chips micro, indicadores |
| `rounded-full` | píldora | **Sólo**: Badge, Avatar, Switch, Slider, Progress |

Dos reglas:

1. **No hay botones píldora.** La píldora dejó de significar "esto se toca" y
   pasa a significar "esto es un estado". Un botón de 8px y una card de 12px se
   leen como documento; todo píldora se lee como juguete.
2. **El hijo va un escalón abajo del padre.** Un Input `rounded-md` dentro de una
   Card `rounded-lg`. Un radio interno mayor que el del contenedor deja una luz
   visible en la esquina.

### Tipografía

Serif de display (`Instrument Serif`) para h1–h6, `Inter` para todo lo demás,
`JetBrains Mono` para código. **El contraste serif/sans es la voz del sistema**:
un heading en sans no es este sistema. El serif ya se aplica en `@layer base`,
no hace falta repetirlo en el JSX.

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
- **`landing` no tiene script de `test`.** `pnpm -r test` lo saltea en silencio: un
  cambio en la landing no está cubierto por unit tests, sólo por E2E.
- E2E se agrega por **flujo que una persona recorre**, no por endpoint. Un endpoint
  nuevo se cubre con unit en la API.

## Cómo está configurado Claude acá

Este archivo es el contexto; `.claude/` es lo que lo hace ejecutable.

| Pieza | Qué hace |
|---|---|
| `.claude/settings.json` | Permisos (los scripts del repo y los comandos de lectura no piden aprobación; deploy, `git push` y el seed están denegados) y el hook de post-edición |
| `.claude/hooks/post-edit-check.sh` | Corre después de cada Edit/Write: paridad i18n, colores crudos, radios fuera de escala, botones píldora, `bg-brand` como relleno, strings inline, `components/ui/` editado, `shared` sin rebuildear |
| `.claude/hooks/pre-push-check.sh` | Bloquea todo `git push` cuyo destino sea main o master. El flujo es rama de feature + PR, y una regla de permisos no puede expresar "salvo a main" |
| `.claude/skills/verify/` | La secuencia de cierre: typecheck → lint → unit → e2e, y cross-browser cuando corresponde |
| `.claude/commands/feature.md` | `/feature <qué>` — implementa respetando el orden shared → api → capa 1 → capa 2 → UI → i18n |
| `.claude/agents/criterio.md` | Agente de producto: afila un pedido vago en un encargo implementable y lo critica antes de que se escriba código |
| `.mcp.json` | MongoDB en modo lectura, tomando `MONGODB_URI` del entorno |

Si agregás una regla nueva a este archivo y se puede verificar con un grep,
agregala también al hook. Una regla que sólo vive en prosa se cumple al principio
de la sesión y se afloja después.

## Deploy

Coolify sobre VPS: `app` (API + SPA) + `landing` (nginx interno) + `mongo`. Todo
en `docs/DEPLOY.md`, incluidas las dos trampas operativas (el network alias de la
landing y el redeploy obligatorio al cambiar env vars).

## Notas

- **pnpm siempre.** Nunca `npm` ni `yarn`.
- Tipos compartidos desde `@luma/shared`.
- Íconos: Lucide React, no emojis ni otra librería.
