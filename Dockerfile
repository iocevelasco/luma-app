# Build multi-stage: el SPA se compila y se copia adentro del servidor de API,
# que lo sirve como estático. Un solo contenedor y un solo deploy.
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@8.6.12 --activate
WORKDIR /app

# Los manifiestos primero: mientras las dependencias no cambien, esta capa se
# reusa y el build no vuelve a bajar el árbol entero.
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/
RUN pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm --filter @luma/shared build \
 && pnpm --filter @luma/api build \
 && pnpm --filter @luma/web build

FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@8.6.12 --activate
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
RUN pnpm install --prod --no-frozen-lockfile --filter @luma/api...

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/api/dist ./packages/api/dist
# El SPA va donde el index.ts lo busca.
COPY --from=builder /app/packages/web/dist ./packages/api/public

EXPOSE 8080
CMD ["node", "packages/api/dist/index.js"]
