#!/bin/sh
# ZenithERP automated PostgreSQL backup script
# Runs daily via crond inside the backup container

BACKUP_DIR="/backups"
RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/zenith_${TIMESTAMP}.sql.gz"

echo "[$(date)] Starting database backup..."

pg_dump -h "$PGHOST" -U "$PGUSER" -d "$PGDATABASE" --no-owner --no-acl | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup completed: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date)] ERROR: Backup failed!"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Remove backups older than RETAIN_DAYS
DELETED=$(find "$BACKUP_DIR" -name "zenith_*.sql.gz" -mtime +${RETAIN_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
    echo "[$(date)] Cleaned up $DELETED old backup(s) (older than ${RETAIN_DAYS} days)"
fi

echo "[$(date)] Backup complete. Total backups: $(ls ${BACKUP_DIR}/zenith_*.sql.gz 2>/dev/null | wc -l)"
