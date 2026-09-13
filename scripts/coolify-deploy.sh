#!/usr/bin/env bash
#
# Dispara un deploy en Coolify.
#
# Normalmente no hace falta: el webhook de GitHub despliega solo en cada push a
# `main`. Esto es para forzar un redeploy sin commit — por ejemplo después de
# cambiar una variable de entorno.
#
#   pnpm deploy            # la app (API + SPA)
#   pnpm deploy landing    # la landing
#
# Requiere ~/.coolify_token (Keys & Tokens → API tokens, con permiso de escritura).

set -Eeuo pipefail

COOLIFY_URL=${COOLIFY_URL:-https://coolify.<DOMINIO>}
TOKEN_FILE=${COOLIFY_TOKEN_FILE:-$HOME/.coolify_token}

# UUIDs de los recursos en Coolify (los da la URL del recurso en la UI).
APP_UUID=${COOLIFY_APP_UUID:-<uuid-de-app>}
LANDING_UUID=${COOLIFY_LANDING_UUID:-<uuid-de-landing>}

case "${1:-app}" in
  app)     UUID=$APP_UUID;     NOMBRE="luma-app" ;;
  landing) UUID=$LANDING_UUID; NOMBRE="luma-landing" ;;
  *) echo "uso: $0 [app|landing]" >&2; exit 2 ;;
esac

if [[ ! -f $TOKEN_FILE ]]; then
  echo "Falta $TOKEN_FILE — creá un token en $COOLIFY_URL → Keys & Tokens." >&2
  exit 1
fi

echo "Desplegando $NOMBRE…"
curl -fsS -X POST "$COOLIFY_URL/api/v1/deploy?uuid=$UUID&force=false" \
  -H "Authorization: Bearer $(cat "$TOKEN_FILE")"
echo
echo "Seguí el progreso en $COOLIFY_URL"
