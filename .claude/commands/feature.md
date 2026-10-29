---
description: Implementa una feature end-to-end respetando el orden del stack de Luma (shared → api → capa 1 → capa 2 → UI → i18n)
argument-hint: [qué hay que implementar]
---

Implementá esto de punta a punta: **$ARGUMENTS**

## Antes de escribir código

Si la feature necesita una **entidad de negocio que no existe**, pará y preguntá.
Mirá primero `packages/api/src/models`: lo que parece nuevo suele ser un campo o un
estado de un modelo que ya está. Inventar un modelo es la forma más cara de
equivocarse acá: cada uno arrastra permisos, purga y migración.

Si el pedido es ambiguo en algo que cambia el resultado — quién lo usa, qué pasa
cuando falla, qué rol de obra lo ve — resolvelo primero. Para eso está el agente
`criterio`: `Agent(subagent_type: "criterio")` con el pedido en crudo te devuelve
el alcance afilado y los agujeros. Usalo cuando el pedido viene en una línea y la
implementación tiene más de un camino razonable.

## El orden

No es preferencia: cada paso compila contra el anterior.

**1. `packages/shared`** — el tipo y el schema Zod. Es la única fuente de verdad
que ven los dos lados. Después: `pnpm --filter @luma/shared build`, porque api y
web importan su `dist`.

**2. `packages/api`** — model (Mongoose) → controller → route.
- Respuestas: `{ success: true, data }`. Errores: se lanzan
  (`throw notFound('...')` de `utils/errors.ts`) y el `errorHandler` los formatea;
  nunca un `res.status().json()` de error a mano.
- Permisos de obra: el router declara `requireCapability('...')` (una celda nueva
  en la grilla de `packages/shared/src/permissions`) y el controller pregunta con
  `req.can(...)`, nunca por rol. `isAuthenticated` → `requireAdmin` queda para el
  área de plataforma.
- Un modelo nuevo con campo `project` se suma a `PROJECT_OWNED`
  (`project-deletion.service.ts`); uno con referencia a `User`, a `USER_REFERENCES`
  (`account-purge.service.ts`). Un test falla si falta.
- Bajas: lógicas (`account_status: 'inactive'` + `enabled: false`). Nunca borrar
  el documento.
- Config: todo por `config/app.config.ts`. Un `process.env` en un controller es
  un bug esperando el deploy.

**3. `packages/web/src/api/*.ts`** — capa 1. Habla con `apiClient` y desempaqueta
el sobre con `unwrap`. Es el único lugar del frontend donde se importa
`apiClient`; ningún componente lo hace.

**4. `packages/web/src/lib/query-keys.ts`** — agregá la clave al enum `QueryKeys`.
Una clave escrita a mano en un hook es una invalidación que un día no encuentra
su caché.

**5. `packages/web/src/hooks/`** — capa 2. `useQuery` para lecturas, `useMutation`
para escrituras y acciones que dispara la persona.
- **`enabled: isAuthenticated` es obligatorio** en toda query contra un endpoint
  protegido. Los providers corren también en las pantallas públicas y un 401 ahí
  dispara `handleUnauthorized` y patea a `/login`, rompiendo el flujo.
- Pantalla pública → la llamada va con `skipAuth: true`.

**6. El componente** — consume el hook, nunca la capa 1 directamente.
- Clases con `cn()` de `@/lib/utils`.
- Tokens semánticos, no colores crudos.
- Radio: la escala está en `CLAUDE.md` (Estilos). Botones, buscador y pestañas son
  `rounded-md` y el `Button` ya trae su radio y su sombra: no le pases `rounded-*`
  ni `shadow-*`. `Card` es `rounded-3xl`; `rounded-full` es sólo para Badge,
  Avatar, Switch, Slider y Progress. El hijo va un escalón abajo del padre.
- `components/ui/` no se edita: se extiende por `className` o se envuelve.
- Íconos: Lucide React.

**7. i18n** — toda clave nueva va a **todos** los idiomas de su paquete en el mismo
cambio: `es`, `es-ES` y `pt` en `packages/web`; `es` y `pt` en `packages/landing`.
Hay un test de paridad en CI. Ningún string visible se escribe inline en el JSX.

**8. Tests** — unit al lado del archivo (`*.spec.ts`). E2E en `/e2e` sólo si la
feature agrega un flujo que una persona recorre, no por cada endpoint.

**9. Cross-browsing** — si tocaste una API del browser, el fallback va en el
**mismo cambio**, detectado con `typeof window.X === 'function'` y nunca con
user-agent. Fechas siempre ISO 8601 con `T`.

## Al terminar

Si tocaste `packages/web`, subí la versión: `pnpm bump:web <patch|minor|major>`.
Es lo que le avisa a una pestaña abierta que hay un deploy nuevo.

Corré el skill `verify`. No digas que está listo antes de eso.
