#!/usr/bin/env bash
# Weekly refresh: triggers the admin crawl endpoint so source registry results
# don't go stale between manual runs. Crawl results still land as
# unconfirmed/review_required, never auto-published -- this only refreshes
# what's waiting for editorial review.
set -euo pipefail

LOCK=/var/run/scholarship-service-crawl.lock
exec 9>"$LOCK"
flock -n 9 || { echo "[crawl] $(date -u +%Y-%m-%dT%H:%M:%SZ) already running, skipping"; exit 0; }

DIR="/opt/scholarship-service"
ADMIN_API_KEY=$(grep -E '^ADMIN_API_KEY=' "$DIR/.env" | cut -d= -f2-)
PORT=$(grep -E '^PORT=' "$DIR/.env" | cut -d= -f2-)
PORT=${PORT:-3080}

echo "[crawl] $(date -u +%Y-%m-%dT%H:%M:%SZ) starting weekly crawl"
RESPONSE=$(curl -sS -m 120 -X POST "http://localhost:${PORT}/api/admin/crawl" \
  -H "x-admin-api-key: ${ADMIN_API_KEY}")
echo "[crawl] $(date -u +%Y-%m-%dT%H:%M:%SZ) result: ${RESPONSE}"
