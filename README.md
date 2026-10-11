# Luma

Base de aplicación: monorepo pnpm con API, SPA y landing. Sesión de usuario,
sistema de diseño, i18n y despliegue resueltos. Sin producto todavía — la home del
panel está deliberadamente vacía.

## Paquetes

- `packages/api` — Express 4 + Mongoose 8 + TypeScript ESM
- `packages/web` — Vite 6 + React 19 + Tailwind v4 + shadcn/ui
- `packages/landing` — landing estática (Vite + React + i18next), servida por nginx
- `packages/shared` — tipos y schemas Zod que comparten API y web

## Arrancar

```bash
pnpm install
cp .env.example .env            # y completá al menos MONGODB_URI y JWT_SECRET
cp .env packages/api/.env
pnpm --filter @luma/api seed:admin   # crea el primer admin desde ADMIN_EMAIL/PASSWORD
pnpm dev                             # api (8080) + web (6173)
pnpm dev:landing                     # landing (5174)
```

Entrá en `http://localhost:6173/login` con las credenciales que sembraste.

## Comandos

```bash
pnpm build        # shared → api → web
pnpm typecheck
pnpm lint
pnpm test         # unit (vitest)
pnpm test:e2e:ci  # E2E chromium
pnpm test:e2e:cross
```

## Qué trae la base

- **Sesión completa**: login, registro, refresh silencioso (un solo `POST /refresh`
  ante un 401, con reintento de la request original), logout, `/me`.
- **Recuperar y cambiar contraseña**, verificación de email, activación de cuenta y
  cambio de email con confirmación.
- **Roles** `admin` y `user`, con guards de ruta en el front y middlewares en la API.
- **Sistema de diseño**: tokens de Tailwind v4, escala única de radio, dark mode,
  60 componentes de shadcn/ui.
- **i18n** en español y portugués, en la app y en la landing, con test de paridad
  de claves.
- **Despliegue** en Coolify: dos Dockerfiles y la guía en `docs/DEPLOY.md`.

## Documentación

- `CLAUDE.md` — convenciones del repo (patrón de llamadas a la API, estilos, i18n,
  cross-browsing).
- `docs/DEPLOY.md` — topología, recursos de Coolify, variables de entorno.
- `docs/BASE-PROMPT.md` — el prompt con el que se generó esta base a partir de otro
  proyecto, y el inventario de qué se copió y qué se descartó.
