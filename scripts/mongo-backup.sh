#!/usr/bin/env bash
#
# Backup de MongoDB: copia local siempre, offsite si hay un remoto configurado.
#
# Las dos mitades protegen de cosas distintas y ninguna reemplaza a la otra:
#
#   local    — un `dropDatabase` por error, una migración mal escrita, un bug
#              que corrompe datos. Es el caso más frecuente y se restaura en
#              segundos. No sirve si el servidor desaparece.
#   offsite  — el servidor desaparece. Es el caso raro y el único que te deja
#              sin nada.
#
# Instalación:
#   sudo install -m 755 mongo-backup.sh /usr/local/bin/
#   sudo install -d -m 700 /etc/luma /var/backups/luma
#   sudo install -m 600 mongo-backup.env /etc/luma/
#   sudo crontab -e
#     15 4 * * * /usr/local/bin/mongo-backup.sh >> /var/log/mongo-backup.log 2>&1
#
# El offsite necesita rclone: curl https://rclone.org/install.sh | sudo bash

set -Eeuo pipefail

ENV_FILE=${ENV_FILE:-/etc/luma/mongo-backup.env}
[[ -f $ENV_FILE ]] && . "$ENV_FILE"

: "${MONGO_CONTAINER:?falta MONGO_CONTAINER}"
: "${MONGO_URI:?falta MONGO_URI}"
LOCAL_DIR=${LOCAL_DIR:-/var/backups/luma}
RETENTION_DAYS=${RETENTION_DAYS:-14}
RCLONE_REMOTE=${RCLONE_REMOTE:-}

STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
ARCHIVE="mongo-${STAMP}.archive.gz"
DEST="$LOCAL_DIR/$ARCHIVE"

install -d -m 700 "$LOCAL_DIR"

log() { echo "[$(date -uIs)] $*"; }

# Se escribe a un temporal y recién al final se renombra: si el dump muere a la
# mitad, no queda un archivo truncado con nombre de backup bueno.
TMP="$DEST.partial"
trap 'rm -f "$TMP"' EXIT

log "dump → $ARCHIVE"
docker exec "$MONGO_CONTAINER" mongodump --uri="$MONGO_URI" --archive --gzip > "$TMP"

SIZE=$(stat -c%s "$TMP")
if (( SIZE < 1024 )); then
  log "ERROR: el dump pesa ${SIZE}B — se descarta, no se pisa el anterior"
  exit 1
fi

# gzip -t detecta un archivo cortado que igual pasó el chequeo de tamaño.
if ! gzip -t "$TMP" 2>/dev/null; then
  log "ERROR: el archivo no es un gzip íntegro — se descarta"
  exit 1
fi

mv "$TMP" "$DEST"
trap - EXIT
log "local ok: $DEST ($(numfmt --to=iec "$SIZE"))"

if [[ -n $RCLONE_REMOTE ]]; then
  log "subiendo a $RCLONE_REMOTE"
  if rclone copy "$DEST" "$RCLONE_REMOTE/" --s3-no-check-bucket; then
    rclone delete "$RCLONE_REMOTE/" --min-age "${RETENTION_DAYS}d" || true
    log "offsite ok"
  else
    # No se aborta: la copia local ya existe y perderla por un fallo de red
    # sería cambiar un backup a medias por ninguno.
    log "AVISO: falló la subida offsite — la copia local quedó guardada"
  fi
else
  log "AVISO: sin RCLONE_REMOTE. Sólo hay copia local, en el mismo disco que la base."
fi

find "$LOCAL_DIR" -name 'mongo-*.archive.gz' -mtime "+$RETENTION_DAYS" -delete
log "listo — $(find "$LOCAL_DIR" -name 'mongo-*.archive.gz' | wc -l) copias locales"
