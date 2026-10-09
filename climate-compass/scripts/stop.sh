#!/usr/bin/env bash
# Stop the Climate Compass backend: free listener on PORT + clear Python caches (never touches .venv).
# Sends SIGTERM first, then SIGKILL if the port is still in use.
# Shows whether local MongoDB still answers (mongod is not stopped by this script).
# Usage:
#   ./scripts/stop.sh
#   PORT=8001 ./scripts/stop.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND="${PROJECT_ROOT}/backend"
PORT="${PORT:-8000}"

kill_port() {
  local pids
  if ! command -v lsof >/dev/null 2>&1; then
    echo "lsof not found; kill the listener on port ${PORT} manually if needed." >&2
    return 0
  fi
  pids="$(lsof -ti ":${PORT}" 2>/dev/null || true)"
  if [[ -z "${pids}" ]]; then
    echo "No process listening on port ${PORT}"
    return 0
  fi

  echo "Stopping PID(s) on port ${PORT}: ${pids}"
  kill -TERM ${pids} 2>/dev/null || true
  sleep 1

  pids="$(lsof -ti ":${PORT}" 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "Force killing remaining PID(s): ${pids}"
    kill -9 ${pids} 2>/dev/null || true
  fi
}

clear_python_caches() {
  echo "Clearing Python caches under ${BACKEND} (skipping backend/.venv)..."
  [[ -d "${BACKEND}" ]] || {
    echo "No backend folder at ${BACKEND}"
    return 0
  }

  (
    cd "${BACKEND}"
    while IFS= read -r -d '' dir; do
      rm -rf "${dir}"
    done < <(find . \( -path './.venv' -prune \) -o -type d -name '__pycache__' -print0)

    while IFS= read -r -d '' dir; do
      rm -rf "${dir}"
    done < <(find . \( -path './.venv' -prune \) -o -type d -name '.pytest_cache' -print0)

    while IFS= read -r -d '' dir; do
      rm -rf "${dir}"
    done < <(find . \( -path './.venv' -prune \) -o -type d -name '.mypy_cache' -print0)

    while IFS= read -r -d '' dir; do
      rm -rf "${dir}"
    done < <(find . \( -path './.venv' -prune \) -o -type d -name '.ruff_cache' -print0)

    while IFS= read -r -d '' file; do
      rm -f "${file}"
    done < <(find . \( -path './.venv' -prune \) -o -type f -name '*.pyc' -print0)
  )

  echo "Cache clear complete."
}

kill_port
clear_python_caches
echo "Stop complete."

mongodb_after_stop_note() {
  local py="${BACKEND}/.venv/bin/python"
  [[ -x "${py}" ]] || {
    echo "MongoDB: (no ${py}; skip status)"
    return 0
  }
  local url
  url="$("${py}" -c "
from pathlib import Path
import os
from dotenv import load_dotenv
b = Path('${BACKEND}')
load_dotenv(b / '.env')
load_dotenv(b.parent / 'config' / '.env')
print(os.getenv('MONGODB_URL', '').strip())
" 2>/dev/null || true)"
  echo ""
  echo "MongoDB:"
  echo "  Note: this script does not stop mongod — only frees port ${PORT} on the API."
  if [[ -z "${url}" ]]; then
    echo "  MONGODB_URL: (empty)"
    return 0
  fi
  if [[ "${url}" == mongodb+srv:* ]] || [[ "${url}" == *mongodb.net/* ]] || [[ "${url}" == *mongodb.net\?* ]]; then
    echo "  URI: Atlas/remote (not probed here)"
    return 0
  fi
  if [[ "${url}" != mongodb://127.0.0.1* ]] && [[ "${url}" != mongodb://localhost* ]]; then
    echo "  Probe: skipped (URI not local mongodb://127.0.0.1* or mongodb://localhost*)"
    return 0
  fi
  export EWS_TMP_MONGO_URI="${url}"
  if "${py}" -c "
from pymongo.mongo_client import MongoClient
import os, sys
u = os.environ.get('EWS_TMP_MONGO_URI','').strip()
try:
    c = MongoClient(u, serverSelectionTimeoutMS=4000)
    c.admin.command('ping')
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; then
    echo "  Local server: still reachable (ping OK)"
  else
    echo "  Local server: not reachable from this machine (mongod stopped or URI wrong)"
  fi
  unset EWS_TMP_MONGO_URI || true
}

mongodb_after_stop_note
