#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WEB_DIR="${ROOT}/web"
HOST=${HOST:-127.0.0.1}
PORT=${PORT:-5173}

if [[ ! -f "${WEB_DIR}/package.json" ]]; then
  echo "Missing ${WEB_DIR}/package.json" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required to run the web dev server." >&2
  exit 1
fi

node <<'NODE'
const [major, minor] = process.versions.node.split(".").map(Number)
if (major < 20 || (major === 20 && minor < 19)) {
  console.error(
    `Node 20.19+ is required for web development. Found ${process.versions.node}.`
  )
  process.exit(1)
}
NODE

if [[ ! -d "${WEB_DIR}/node_modules" ]]; then
  npm --prefix "${WEB_DIR}" ci
fi

npm --prefix "${WEB_DIR}" run dev -- --host "${HOST}" --port "${PORT}" "$@"
