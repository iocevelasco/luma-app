#!/usr/bin/env bash
# Bloquea cualquier `git push` cuyo destino sea main (o master).
#
# Por qué un hook y no una regla de permisos: las reglas de settings.json son
# prefijos —`Bash(git push:*)`— y no pueden expresar "salvo a main". Para saber
# adónde va un push hay que mirar el comando Y la rama actual, porque
# `git push` a secas empuja la rama en la que estás.
#
# El análisis lo hace node y no grep porque un grep suelto sobre el comando
# entero da falsos positivos: un `git commit` cuyo MENSAJE menciona
# "git push origin main" no es un push. Antes de decidir hay que sacar los
# heredocs y los strings entre comillas, y mirar sólo las posiciones donde
# empieza un comando de verdad.
#
# Sale con código 2: eso bloquea la herramienta y devuelve el texto al modelo.
set -uo pipefail

# RAMA_OVERRIDE existe para poder testear el hook sin cambiar de rama.
RAMA_ACTUAL=${RAMA_OVERRIDE:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")}

SALIDA=$(RAMA="$RAMA_ACTUAL" node "$(dirname "$0")/pre-push-check.mjs")
CODIGO=$?

if [ "$CODIGO" -ne 0 ]; then
  printf '%s\n' "$SALIDA" >&2
  exit 2
fi
exit 0
