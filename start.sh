#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_PATH="$(realpath "${1:-$PWD}")"

export REPO_PATH

echo "Serving: $REPO_PATH"
echo "Open:    http://localhost:8080"

docker compose -f "$SCRIPT_DIR/compose.yml" up --build
