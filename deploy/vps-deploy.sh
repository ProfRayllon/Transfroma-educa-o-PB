#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/transforma}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8080/api/health}"

cd "$APP_DIR"

git fetch origin main
git reset --hard origin/main

# Um build de cada vez: os dois em paralelo, com o sistema no ar, passavam da
# memoria da VPS (~1 GB) e travavam a maquina.
COMPOSE_PARALLEL_LIMIT=1 docker compose build
docker compose up -d --force-recreate

attempts=20
for i in $(seq 1 "$attempts"); do
  if curl -fsS "$HEALTH_URL" >/tmp/transforma-health.json; then
    cat /tmp/transforma-health.json
    exit 0
  fi

  sleep 3
done

echo "Health check falhou apos ${attempts} tentativas." >&2
docker compose logs --tail=200 api web >&2
exit 1
