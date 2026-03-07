#!/usr/bin/env bash
set -euo pipefail

if [ -z "${POSTGRES_RESTORE_FILE:-}" ]; then
  echo "[restore] POSTGRES_RESTORE_FILE is empty. Skipping optional restore."
  exit 0
fi

BACKUP_PATH="/backups/${POSTGRES_RESTORE_FILE}"

if [ ! -f "$BACKUP_PATH" ]; then
  echo "[restore] Backup file not found: $BACKUP_PATH"
  echo "[restore] Skipping restore."
  exit 0
fi

echo "[restore] Restoring backup from: $BACKUP_PATH"

case "$BACKUP_PATH" in
  *.sql)
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$BACKUP_PATH"
    ;;
  *.dump|*.backup)
    pg_restore \
      --clean \
      --if-exists \
      --no-owner \
      --no-privileges \
      -U "$POSTGRES_USER" \
      -d "$POSTGRES_DB" \
      "$BACKUP_PATH"
    ;;
  *)
    echo "[restore] Unsupported backup format. Use .sql, .dump or .backup"
    exit 1
    ;;
esac

echo "[restore] Backup restore completed."
