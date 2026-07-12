#!/usr/bin/env bash
# Start ColdCallReps local dev on port 3005 (frees the port first).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3005}"

cd "$ROOT"

pids="$(lsof -ti:"$PORT" 2>/dev/null || true)"
if [[ -n "$pids" ]]; then
  echo "Clearing port $PORT (pids: $pids)..."
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 0.5
fi

echo "Starting ColdCallReps on http://localhost:$PORT ..."
export PORT
exec npm run dev
