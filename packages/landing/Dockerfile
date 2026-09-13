# Se construye desde la RAÍZ del repo, no desde packages/landing: la landing es
# parte del workspace de pnpm y necesita el lockfile de arriba.
#
# Sin el lockfile del workspace, cada build resuelve el árbol de cero y termina
# fallando con ERESOLVE (lucide-react declara un peer `react@^19.0.0-rc` y el
# repo usa react 19.2.0). Con él, la resolución ya está decidida y el build es
# reproducible.
FROM node:20-alpine AS build

RUN corepack enable && corepack prepare pnpm@8.6.12 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Todos los package.json del workspace: `--frozen-lockfile` compara el lockfile
# contra los proyectos que encuentra, y si falta uno aborta con "not up to date".
COPY packages/landing/package.json ./packages/landing/
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/
COPY packages/web/package.json ./packages/web/

RUN pnpm install --frozen-lockfile --prod=false --filter @luma/landing...

COPY packages/landing ./packages/landing

ARG VITE_APP_URL=http://localhost:5173
ENV VITE_APP_URL=$VITE_APP_URL

RUN pnpm --filter @luma/landing build

FROM nginx:alpine

COPY --from=build /app/packages/landing/dist /usr/share/nginx/html

RUN printf 'server {\n\
  listen 8080;\n\
  gzip on;\n\
  gzip_types text/css application/javascript application/json image/svg+xml;\n\
\n\
  # Assets under /home/assets/ served from dist/assets/\n\
  location /home/assets/ {\n\
    alias /usr/share/nginx/html/assets/;\n\
    add_header Cache-Control "public, max-age=31536000, immutable";\n\
  }\n\
\n\
  # SPA fallback for /home/* routes.\n\
  # Use a named location so the internal redirect to index.html does NOT\n\
  # fall through into the catch-all "location /" block below.\n\
  location /home {\n\
    root /usr/share/nginx/html;\n\
    try_files $uri @spa;\n\
  }\n\
\n\
  location @spa {\n\
    root /usr/share/nginx/html;\n\
    try_files /index.html =404;\n\
  }\n\
\n\
  # Root redirect\n\
  location = / {\n\
    return 301 /home;\n\
  }\n\
\n\
  # Login redirect\n\
  location = /login {\n\
    return 301 /app/login;\n\
  }\n\
\n\
  # 404 for everything else\n\
  location / {\n\
    return 404;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
