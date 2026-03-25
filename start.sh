#!/usr/bin/env bash

# Find the first free host port starting from the given port
#
# Parameters:
#   $1 - Port number to test
#
# Returns:
#   0 - Port is in use
#   1 - Port is free
port_in_use() {
  ss -tln 2>/dev/null | awk '{print $4}' | grep -qE "(^|:)${1}$"
}

main() {
  set -euo pipefail

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local repo_path
  repo_path="$(realpath "${1:-$PWD}")"

  # Deterministic project name per repo — avoids container conflicts across instances
  local project="git-browse-$(printf '%s' "$repo_path" | md5sum | cut -c1-8)"

  local -a compose
  compose=(docker compose -p "$project" -f "$script_dir/compose.yml")

  # If this repo's container is already running, show its URL and tail logs
  if "${compose[@]}" ps --status running --quiet 2>/dev/null | grep -q .; then
    local port
    port=$("${compose[@]}" port markserv 8080 2>/dev/null | cut -d: -f2)
    echo "Already running: $repo_path"
    echo "Open:            http://localhost:${port}"
    echo "(Ctrl+C to detach from logs)"
    exec "${compose[@]}" logs -f
  fi

  # Find free host ports — HTTP from 8080, livereload from 35729
  local port=8080
  while port_in_use "$port"; do
    port=$((port + 1))
  done

  local livereload_port=35729
  while port_in_use "$livereload_port"; do
    livereload_port=$((livereload_port + 1))
  done

  export REPO_PATH="$repo_path" PORT="$port" LIVERELOAD_PORT="$livereload_port"

  echo "Serving: $repo_path"
  echo "Open:    http://localhost:$port"

  "${compose[@]}" up --build -d
  xdg-open "http://localhost:$port" 2>/dev/null \
    || open   "http://localhost:$port" 2>/dev/null \
    || true
  exec "${compose[@]}" logs -f
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
