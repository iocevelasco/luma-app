# Deploy — Coolify sobre VPS

Guía operativa del despliegue. Tres recursos, una sola puerta a internet.

## Topología

```
Traefik (:443, lo pone Coolify)
  └── app :8080 (Express)   /api/*   API
                            /app/*   SPA, servida como estático desde packages/api/public
                            /home/*  → proxy por la red interna de Docker
                               └── landing :8080 (nginx, SIN dominio público)
      mongo :27017 (sin puerto público)
```

`packages/web` y `packages/shared` **no son servicios**: se compilan dentro de la
imagen de `app` —la SPA termina en `packages/api/public`— y desaparecen.

La landing no tiene dominio a propósito. Sólo la alcanza el proxy de la API por
la red interna, así que hay un único certificado, un único origen y ningún CORS
entre la app y su propia página pública.

## Recursos en Coolify

| Recurso | Build Pack | Base Directory | Dockerfile | Expone | Dominio |
|---|---|---|---|---|---|
| `app` | Dockerfile | `/` | `/Dockerfile` | 8080 | `https://<DOMINIO>` · Health Check `/health` |
| `landing` | Dockerfile | `/` | `/packages/landing/Dockerfile` | 8080 | **vacío** · network alias `landing` |
| `mongo` | recurso "MongoDB 8" | — | — | 27017 | sin puerto público · alias `mongo` |

**Base Directory es `/` también para la landing.** Su Dockerfile se construye desde
la raíz del repo porque necesita el `pnpm-lock.yaml` y todos los `package.json` del
workspace: con `--frozen-lockfile`, si falta uno, el build aborta con un
"lockfile not up to date" que no dice cuál falta.

URI de Mongo: `mongodb://<user>:<pass>@mongo:27017/<db>?authSource=admin`. El
nombre de la base no admite guiones en el formulario de Coolify.

## Dos trampas operativas

1. **El network alias de `landing` se fija ANTES del primer deploy.** Si no, Docker
   le da un hostname aleatorio, `LANDING_URL=http://landing:8080` no resuelve y
   `/home` devuelve 502.
2. **Cambiar dominio, alias o variables de entorno exige redesplegar.** Todo eso se
   escribe como labels y env del contenedor en el momento de crearlo: editarlo en
   la UI no toca el contenedor que está corriendo.

## Variables de entorno — servicio `app`

| Variable | Rol | Si falta |
|---|---|---|
| `NODE_ENV`, `PORT`, `HOST` | las fija el Dockerfile | — |
| `MONGODB_URI` | conexión a Mongo | cae a `mongodb://localhost:27017/luma` |
| `JWT_SECRET` | HS256 | **la API no arranca** (alternativa: `JWT_PRIVATE_KEY_PEM` + `JWT_PUBLIC_KEY_PEM`) |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | opcionales | `7d` / `90d` |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v3 | **la API no arranca en producción** |
| `FRONTEND_URL` | origen del front | `http://localhost:5173` |
| `APP_URL` | raíz del SPA **con subpath**: `https://<DOMINIO>/app` | cae a `FRONTEND_URL`; rompe los links de los mails y los redirects |
| `ALLOWED_ORIGINS` | whitelist de CORS, separada por comas | sólo entra `FRONTEND_URL` |
| `LANDING_URL` | `http://landing:8080` | ese mismo default |
| `RESEND_API_KEY`, `EMAIL_FROM`, `APP_NAME` | mails | aviso; los mails quedan deshabilitados |
| `STORAGE_ENDPOINT`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | fotos de evidencia (RF-04), cualquier S3-compatible (Backblaze B2, R2, S3) | aviso; subir evidencia da 503, el resto de la app sigue |
| `STORAGE_REGION`, `STORAGE_SIGNED_URL_TTL` | opcionales | `auto` / `3600` segundos |

Build args (las `VITE_*` se hornean en el bundle, no se leen en runtime):
`VITE_RECAPTCHA_SITE_KEY` en `app`, `VITE_APP_URL` en `landing`
(`https://<DOMINIO>/app`).

## Primer arranque

Con la base vacía no hay con qué entrar. El seed se corre **compilado**: la imagen
de producción no tiene `src/` ni `tsx`.

```bash
docker exec --env-file /tmp/admin.env -w /app/packages/api <container> \
  node dist/scripts/seed-admin.js
```

Donde `/tmp/admin.env` trae `ADMIN_EMAIL`, `ADMIN_PASSWORD` y opcionalmente
`ADMIN_NAME`. El script es idempotente: si el usuario ya existe, le resetea la
contraseña y lo deja como admin activo.

## Verificar

```bash
curl https://<DOMINIO>/health      # {"status":"ok","database":"connected"}
curl -I https://<DOMINIO>/         # 301 → /home
curl -I https://<DOMINIO>/app/     # 200, la SPA
```

## Coolify desde Claude (MCP)

`.mcp.json` configura el servidor MCP de Coolify con **lectura y escritura**:
111 herramientas que cubren la API v4 completa — servidores, proyectos,
aplicaciones, bases, servicios, variables de entorno, backups, logs y deploys.

### Las dos variables que hay que exportar

El token **nunca va al repo**. `.mcp.json` sólo referencia el entorno:

```bash
# en ~/.zshrc
export COOLIFY_URL=https://coolify.<DOMINIO>
export COOLIFY_TOKEN=$(cat ~/.coolify_token)
```

`COOLIFY_URL` es la misma variable que ya usa `scripts/coolify-deploy.sh`, y
`~/.coolify_token` el mismo archivo: un solo token, un solo lugar. El token se
crea en Coolify → **Keys & Tokens → API tokens**, con permiso de escritura.

Sin esas variables el servidor arranca igual pero toda llamada falla con 401.

### Qué puede hacer y qué conviene saber

De las 111 herramientas, **24 son destructivas e irreversibles**:
`delete_server`, `delete_project`, `delete_database`, `delete_application`,
`delete_private_key` y compañía. Borrar una base en Coolify borra los datos; no
hay baja lógica como en el modelo de la app.

Ninguna herramienta del MCP está en la lista `allow` de
`.claude/settings.json`, así que **todas piden aprobación en el momento**. Eso
es deliberado: la capacidad de escritura está habilitada, pero cada acción se
confirma. Si alguna se usa muy seguido y molesta el prompt, se agrega
explícitamente al `allow` — y conviene que sean sólo las de lectura
(`list_*`, `get_*`, `health_check`).

Ojo con la asimetría: el MCP puede desplegar y cambiar variables de entorno sin
pasar por git. Las reglas que impiden pushear a main o correr `pnpm deploy` no
lo alcanzan, porque habla con la API de Coolify directo.
