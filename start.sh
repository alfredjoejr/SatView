#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required. Please install Node.js and try again." >&2
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

exec node scripts/dev.ts "$@"
