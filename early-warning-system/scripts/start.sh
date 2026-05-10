#!/usr/bin/env bash
# Start the Early Warning backend: free PORT, clear caches, run uvicorn, open the landing page in Chrome.
# Loads MONGODB_URL like FastAPI (backend/.env then config/.env) and pings local Mongo if applicable.
#
# Usage:
#   ./scripts/start.sh
#   PORT=8001 ./scripts/start.sh
#   OPEN_BROWSER=0 ./scripts/start.sh          # do not open a browser
#   LANDING_URL=http://127.0.0.1:8000/ ./scripts/start.sh   # override URL (default uses PORT)
#   MONGO_STRICT=1 ./scripts/start.sh       # exit non-zero if local Mongo URI but server unreachable
#
# Landing: http://127.0.0.1:${PORT}/  (serves landing/landing.html; avoid http://0.0.0.0 in browser)
# Dashboard: http://127.0.0.1:${PORT}/frontend/index.html

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND="${PROJECT_ROOT}/backend"
PORT="${PORT:-8000}"
STOP_SCRIPT="${SCRIPT_DIR}/stop.sh"
LANDING_URL="${LANDING_URL:-http://127.0.0.1:${PORT}/}"

if [[ ! -d "${BACKEND}" ]]; then
  echo "Expected backend at ${BACKEND}" >&2
  exit 1
fi

echo "Cleaning port ${PORT} and caches..."
bash "${STOP_SCRIPT}"

cd "${BACKEND}"

if [[ ! -d .venv ]]; then
  echo "No .venv — create with: cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt" >&2
  exit 1
fi

# shellcheck source=/dev/null
source .venv/bin/activate

mongodb_load_and_report() {
  local url safe host_is_local ping_rc

  url="$(python -c "
from pathlib import Path
import os
from dotenv import load_dotenv
b = Path('.').resolve()
load_dotenv(b / '.env')
load_dotenv(b.parent / 'config' / '.env')
print(os.getenv('MONGODB_URL', '').strip())
")"
  echo ""
  echo "MongoDB:"
  if [[ -z "${url}" ]]; then
    echo "  Status: not configured (empty MONGODB_URL) — API runs without persistence"
    return 0
  fi

  export EWS_TMP_MONGO_URI="${url}"
  safe="$(python -c "
import os
u = os.environ.get('EWS_TMP_MONGO_URI','').strip()
if not u:
    print('')
elif '://' in u and '@' in u.split('://',1)[-1]:
    pre, rest = u.split('://',1)
    _, hostpart = rest.split('@',1)
    print(pre + '://***@' + hostpart)
else:
    print(u)
")"
  echo "  URI: ${safe}"

  host_is_local=0
  if [[ "${url}" == mongodb+srv:* ]] || [[ "${url}" == *mongodb.net/* ]] || [[ "${url}" == *mongodb.net\?* ]]; then
    echo "  Probe: skipping (looks like Atlas/remote — connectivity checked when API starts)"
    unset EWS_TMP_MONGO_URI || true
    return 0
  fi
  if [[ "${url}" == mongodb://127.0.0.1* ]] || [[ "${url}" == mongodb://localhost* ]]; then
    host_is_local=1
  fi
  if [[ "${host_is_local}" -eq 0 ]]; then
    echo "  Probe: skipping (URI does not look like local mongodb://127.0.0.1 or localhost)"
    unset EWS_TMP_MONGO_URI || true
    return 0
  fi

  ping_rc=0
  python -c "
from pymongo.mongo_client import MongoClient
import os, sys
u = os.environ.get('EWS_TMP_MONGO_URI','').strip()
try:
    c = MongoClient(u, serverSelectionTimeoutMS=5000)
    c.admin.command('ping')
except Exception as e:
    print(e, file=sys.stderr)
    sys.exit(1)
" || ping_rc=$?

  unset EWS_TMP_MONGO_URI || true

  if [[ "${ping_rc}" -eq 0 ]]; then
    echo "  Status: connected (ping OK)"
  else
    echo "  Status: NOT reachable — start mongod or fix MONGODB_URL (API will still start without DB)" >&2
    if [[ "${MONGO_STRICT:-0}" == "1" ]]; then
      echo "MONGO_STRICT=1 and local Mongo ping failed — aborting." >&2
      exit 1
    fi
  fi
}

wait_for_api() {
  local i url="http://127.0.0.1:${PORT}/api/health"
  echo ""
  echo "Waiting for API at ${url} ..."
  for ((i = 0; i < 120; i++)); do
    if curl -sf --connect-timeout 1 --max-time 3 "${url}" >/dev/null 2>&1; then
      echo "  API ready."
      return 0
    fi
    if ! kill -0 "${UVICORN_PID}" 2>/dev/null; then
      echo "  Uvicorn exited before the server became ready." >&2
      return 1
    fi
    sleep 0.25
  done
  echo "  Timed out waiting for health check." >&2
  return 1
}

open_landing_in_chrome() {
  [[ "${OPEN_BROWSER:-1}" != "0" ]] || return 0

  local url="${LANDING_URL}"
  echo ""
  echo "Opening landing page: ${url}"

  case "$(uname -s)" in
    Darwin)
      if [[ -d "/Applications/Google Chrome.app" ]]; then
        open -a "Google Chrome" "${url}" 2>/dev/null || open "${url}" 2>/dev/null || true
      else
        echo "  Google Chrome not found under /Applications — using default browser." >&2
        open "${url}" 2>/dev/null || true
      fi
      ;;
    Linux)
      if command -v google-chrome >/dev/null 2>&1; then
        google-chrome "${url}" 2>/dev/null &
      elif command -v google-chrome-stable >/dev/null 2>&1; then
        google-chrome-stable "${url}" 2>/dev/null &
      elif command -v chromium >/dev/null 2>&1; then
        chromium "${url}" 2>/dev/null &
      elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "${url}" 2>/dev/null &
      else
        echo "  Install Chrome or set OPEN_BROWSER=0. URL: ${url}"
      fi
      ;;
    *)
      echo "  Open in your browser: ${url}"
      ;;
  esac
}

cleanup() {
  [[ "${EWS_CLEANED_UP:-0}" -eq 1 ]] && return 0
  if [[ -n "${UVICORN_PID:-}" ]] && kill -0 "${UVICORN_PID}" 2>/dev/null; then
    echo ""
    echo "Stopping uvicorn (PID ${UVICORN_PID})..."
    kill -TERM "${UVICORN_PID}" 2>/dev/null || true
    sleep 0.5
    kill -9 "${UVICORN_PID}" 2>/dev/null || true
  fi
  EWS_CLEANED_UP=1
}

on_interrupt() {
  cleanup
  exit 130
}

export PORT
mongodb_load_and_report

echo ""
echo "Starting API on http://0.0.0.0:${PORT}"
echo "  Landing:   http://127.0.0.1:${PORT}/"
echo "  Dashboard: http://127.0.0.1:${PORT}/frontend/index.html"

python -m uvicorn main:app --host 0.0.0.0 --port "${PORT}" &
UVICORN_PID=$!

trap cleanup EXIT
trap on_interrupt INT
trap 'cleanup; exit 143' TERM

if ! wait_for_api; then
  exit 1
fi

open_landing_in_chrome

echo ""
echo "Server running (Ctrl+C to stop)."
wait "${UVICORN_PID}" || true
