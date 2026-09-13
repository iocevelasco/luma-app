# Build multi-stage del servicio `app`: API Express que además sirve la SPA
# compilada desde packages/api/public y proxea /home a la landing.
FROM node:20-alpine AS base

RUN corepack enable && corepack prepare pnpm@8.6.12 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
COPY packages/landing/package.json ./packages/landing/

# `--prod=false` es obligatorio, no una preferencia: el builder inyecta las
# variables de entorno de la app como build args, y con NODE_ENV=production
# pnpm omite las devDependencies. Sin ellas no hay `tsc` y el build muere en el
# primer `pnpm --filter @luma/shared build` con un `sh: tsc: not found` que no
# dice nada sobre la causa real.
RUN pnpm install --frozen-lockfile --prod=false

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api
COPY packages/web ./packages/web

FROM base AS build

# Las VITE_* se hornean en el bundle: tienen que existir en build time.
ARG VITE_RECAPTCHA_SITE_KEY
ENV VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY

RUN pnpm --filter @luma/shared build
RUN pnpm --filter @luma/web build
RUN pnpm --filter @luma/api build

FROM node:20-alpine AS production

RUN corepack enable && corepack prepare pnpm@8.6.12 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/packages/api/dist ./packages/api/dist
COPY --from=build /app/packages/api/package.json ./packages/api/

# La SPA compilada se sirve como estático desde la API.
COPY --from=build /app/packages/web/dist ./packages/api/public

WORKDIR /app/packages/api

# El puerto que espera el proxy (Traefik).
EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0

CMD ["node", "dist/index.js"]
