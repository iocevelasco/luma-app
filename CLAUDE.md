# Luma — guía para Claude

## Contexto

Plataforma de gestión de obras y remodelaciones. El esqueleto viene de
`pantera-negra-wep-app` (arquitectura, auth, multi-tenant, stack); el dominio es
nuevo. Ver `docs/ANALISIS-PANTERA.md` para el contraste completo.

## Stack

- **Monorepo**: pnpm workspaces — `packages/shared`, `packages/api`, `packages/web`
- **Backend**: Node ESM (`"type": "module"`), Express 4, Mongoose 8, Zod 3, JWT
  (HS256 o RS256), bcryptjs, Resend, `@anthropic-ai/sdk`, node-cron
- **Frontend**: React 19, Vite 6, TypeScript, Tailwind v4 (CSS-first, sin
  `tailwind.config.js`), TanStack Query v5, React Router v6, Zustand
- **Base**: MongoDB, multi-tenant por `project_id`

## Reglas que no se negocian

Vienen del documento funcional y romperlas rompe el producto:

1. **Ningún imprevisto se comunica al cliente sin aprobación interna previa.**
   La máquina de estados de `services/contingency.service.ts` lo impone.
2. **`why_happened` es obligatorio.** A nivel de schema Mongoose, no sólo de
   formulario. Es lo que convierte un cobro en una explicación.
3. **El presupuesto no se modifica sin decisión registrada del cliente.**
4. **El cliente nunca ve información operativa interna.** Su dashboard es un
   endpoint propio (`routes/client.ts`), no un filtro sobre el interno.
5. **El historial de imprevistos es inmutable.** `history` sólo crece.
6. **Un proyecto puede tener más de un usuario en rol cliente**, con los mismos
   permisos.
7. **Toda acción que afecte presupuesto o cronograma queda auditada.**
   `services/audit.service.ts`.
8. **No hay pagos ni anticipos.** Si aparece un modelo `Payment`, algo se
   entendió mal.
9. **El presupuesto inicial se carga por importación y queda como línea base.**
   Una recarga crea una versión nueva; la 1 se conserva.

## Convenciones

### Permisos

Se pide el **permiso**, nunca el rol:

```ts
// Backend
router.post('/', requirePermission('materials.manage'), handler);

// Frontend
const { can } = useAuth();
{can('materials.manage') && <Button>…</Button>}
```

`ROLE_PERMISSIONS` vive en `packages/shared/src/types/index.ts`. Un permiso
nuevo se agrega ahí y las dos puntas lo ven.

### Validación

Un solo schema Zod en `packages/shared/src/schemas/` por payload. El formulario
y el controlador lo importan del mismo lugar. En el backend se aplica con
`validateBody(schema)`, que además reemplaza `req.body` por el resultado
parseado.

### Errores

Los servicios lanzan `HttpError` (o los helpers `badRequest`, `forbidden`,
`notFound`…). `middleware/errorHandler.ts` los traduce. Ninguna capa de negocio
toca `res`.

Las rutas async se envuelven en `asyncHandler()`: Express 4 no captura rechazos
de promesas.

### Multi-tenant

`withProject` resuelve el proyecto (header `X-Project-Id`, param de ruta o
token) y **valida la membresía contra la base**, no contra el token. Si a
alguien lo sacan del proyecto, su token sigue siendo válido hasta que expire.

### Frontend

- Composición: `Guard → Shell → páginas`. El shell monta providers y chrome una
  sola vez.
- Clases con `cn()`. Tokens semánticos (`bg-card`, `text-muted-foreground`),
  nunca colores crudos.
- Redondeo: píldora = se toca (Button, Badge, chips); `rounded-lg` = superficie
  (Card); el hijo va un escalón abajo del padre.
- Altura táctil mínima 44px: la app se usa con guantes de obra.
- Las query keys llevan el `project_id` adentro, siempre.
- Nada de `localStorage` para estado compartido; sólo el token y el proyecto
  activo, que el api-client necesita fuera de React.

## Comandos

```bash
pnpm dev          pnpm build         pnpm typecheck
pnpm dev:api      pnpm dev:web       pnpm seed:demo
```

Después de tocar `packages/shared` hay que rebuildearlo para que api y web vean
los cambios: `pnpm --filter @luma/shared build`.
