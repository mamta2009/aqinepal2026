#!/usr/bin/env bash
# Climate Compass — air evaluate loop (cron-friendly).
#
# Secrets:
# - Local / VPS with a file: loads ../backend/.env automatically (gitignored).
# - Render / cloud: set NOTIFICATION_API_KEY (and API_BASE) in the service env —
#   same place as the web API secrets. Do not put the key in frontend/.env.local.
#
# Usage:
#   ./cron-evaluate-air.sh
#   API_BASE="https://climatecompass.intelladapt.ai" ./cron-evaluate-air.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/../backend/.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# Prefer explicit API_BASE; else PUBLIC_API_ORIGIN from .env; else local API.
API_BASE="${API_BASE:-${PUBLIC_API_ORIGIN:-http://127.0.0.1:8000}}"
API_BASE="${API_BASE%/}"

API_KEY="${NOTIFICATION_API_KEY:-}"
if [[ -z "${API_KEY}" ]]; then
  echo "NOTIFICATION_API_KEY is empty. Set it in backend/.env or the process environment." >&2
  exit 1
fi

MIN_LEVEL="${MIN_LEVEL:-MODERATE}"
RECIPIENT_TYPE="${RECIPIENT_TYPE:-all}"

CITIES=(Kathmandu Pokhara Bharatpur Birgunj Biratnagar Janakpur Nepalgunj Dhangadhi)

echo "API_BASE=${API_BASE}  min_level=${MIN_LEVEL}  cities=${#CITIES[@]}"

for city in "${CITIES[@]}"; do
  echo "=== evaluate air: ${city} ==="
  curl -sS -X POST "${API_BASE}/api/alerts/evaluate" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${API_KEY}" \
    -d "{\"city\":\"${city}\",\"recipient_type\":\"${RECIPIENT_TYPE}\",\"min_level\":\"${MIN_LEVEL}\"}"
  echo
  sleep 2
done
