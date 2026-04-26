#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WEB_DIR="${ROOT}/web"
DIST_DIR="${WEB_DIR}/dist"
TARGET_DIR="${ROOT}/Sources/imsg/Resources/web"

if [[ ! -f "${WEB_DIR}/package.json" ]]; then
  echo "Missing ${WEB_DIR}/package.json" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js and npm are required to build the web client." >&2
  exit 1
fi

node <<'NODE'
const [major, minor] = process.versions.node.split(".").map(Number)
if (major < 20 || (major === 20 && minor < 19)) {
  console.error(
    `Node 20.19+ is required for the web build. Found ${process.versions.node}.`
  )
  process.exit(1)
}
NODE

if [[ ! -d "${WEB_DIR}/node_modules" ]]; then
  (
    cd "${WEB_DIR}"
    npm ci
  )
fi

(
  cd "${WEB_DIR}"
  npm run build
)

mkdir -p "${TARGET_DIR}"
find "${TARGET_DIR}" -mindepth 1 -maxdepth 1 ! -name "debug.html" -exec rm -rf {} +
cp -R "${DIST_DIR}/." "${TARGET_DIR}/"

echo "Copied ${DIST_DIR} into ${TARGET_DIR}"
