#!/usr/bin/env bash
# Climate Compass — air evaluate loop (cron-friendly).
#
# Secrets:
# - Local / VPS with a file: loads ../backend/.env automatically (gitignored).
# - Render / cloud: set NOTIFICATION_API_KEY (and API_BASE) in the service env —
#   same place as the web API secrets. Do not put the key in frontend/.env.local.
#
# Usage (on the API server, with backend/.env present):
#   ./cron-evaluate-air.sh
# Explicit override:
#   API_BASE="https://ews-api.intelladapt.ai" ./cron-evaluate-air.sh
#
# Production layout:
#   API      https://ews-api.intelladapt.ai
#   Frontend https://climatecompass.intelladapt.ai
#   PUBLIC_API_ORIGIN in backend/.env should match the API host.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-${SCRIPT_DIR}/../backend/.env}"

# Load KEY=VALUE from .env without `source` (avoids executing comments / bare text
# like "Warning: ..." as shell commands — common when a note lacks a leading #).
load_dotenv() {
  local file="$1"
  local line key val
  while IFS= read -r line || [[ -n "${line}" ]]; do
    line="${line%$'\r'}"
    [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
    [[ "${line}" =~ ^[[:space:]]*export[[:space:]]+ ]] && line="${line#*export }"
    [[ "${line}" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]] || continue
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    if [[ "${val}" =~ ^\"(.*)\"$ ]]; then
      val="${BASH_REMATCH[1]}"
    elif [[ "${val}" =~ ^\'(.*)\'$ ]]; then
      val="${BASH_REMATCH[1]}"
    fi
    export "${key}=${val}"
  done < "${file}"
}

if [[ -f "${ENV_FILE}" ]]; then
  load_dotenv "${ENV_FILE}"
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
