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
    (echo >/dev/tcp/localhost/"$1") &>/dev/null
}

# Open the given URL in the default browser, if possible
#
# Parameters:
#   $1 - URL to open
open_browser() {
    local url="$1"
    if command -v xdg-open &>/dev/null; then
        xdg-open "$url" &>/dev/null & disown # Linux
    elif command -v open &>/dev/null; then
        open "$url" &>/dev/null & disown # macOS
    else
        echo "Please open your browser and navigate to: $url"
    fi
}

# Log a debug message to stderr
#
# Parameters:
#   $* - Message to log
log_debug() {
    echo "DEBUG: $*" >&2
}

# Cross-platform md5 function
#
# Parameters:
#   $1 - String to hash
#
# Returns:
#   First 8 characters of the MD5 hash
get_md5_short() {
    if command -v md5sum &>/dev/null; then
        printf '%s' "$1" | md5sum | cut -c1-8
    elif command -v md5 &>/dev/null; then
        printf '%s' "$1" | md5 -q | cut -c1-8
    else
        # Fallback to a simple hash if neither exists
        printf '%s' "$1" | cksum | cut -f1 -d' '
    fi
}

stop_container() {
    log_debug "Stopping container for project $project"
    docker compose -p "$project" -f "$compose_path" down
}

# Parameters:
#   $1 - Path to resolve
get_realpath() {
    if command -v realpath &>/dev/null; then
        realpath "$1"
    else
        echo "Error: 'realpath' is not installed." >&2
        echo "Please install coreutils: 'brew install coreutils' (macOS) or 'apt install coreutils' (Linux)." >&2
        exit 1
    fi
}

main() {
    set -euo pipefail

    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    compose_path="$script_dir/compose.yml"
    
    local path_to_open
    path_to_open="$(get_realpath "${1:-$PWD}")"

    local server_root
    local sub_path=""
    if ! server_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
        echo "Not a git repository: $path_to_open" >&2
        server_root="$path_to_open"
    else
        # Compute sub-path relative to repo root so the browser opens at the right location
        sub_path="${path_to_open#$server_root}"
    fi

    log_debug "Resolved server root: $server_root"
    log_debug "Resolved sub-path: $sub_path"

    local url="http://localhost:8080${sub_path}/"
    log_debug "Initial URL to open: $url"

    # Deterministic project name per repo — avoids container conflicts across instances.
    # Align with src/server.js: use root commit hash as the primary differentiator.
    local git_hash
    git_hash=$(git -C "$server_root" rev-list --max-parents=0 HEAD 2>/dev/null | cut -c1-8 || echo "")
    local repo_id
    if [[ -n "$git_hash" ]]; then
        repo_id="$git_hash"
    else
        repo_id="$(get_md5_short "$server_root")"
    fi
    project="git-browse-$repo_id"

    local -a compose
    compose=(docker compose -p "$project" -f "$compose_path")

    # If this repo's container is already running, show its URL and tail logs
    if "${compose[@]}" ps --status running --quiet 2>/dev/null | grep -q .; then
        local port
        port=$("${compose[@]}" port git-browse 8080 2>/dev/null | cut -d: -f2)
        echo "Already running: $server_root"
        echo "Open:            $url"
        echo "(Ctrl+C to stop)"
        trap '"${compose[@]}" stop' INT TERM
        "${compose[@]}" logs -f
        return
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

    local repo_name
    repo_name="$(basename "$server_root")"
    export REPO_PATH="$server_root" PORT="$port" LIVERELOAD_PORT="$livereload_port" GIT_BROWSE_REPO_ID="$repo_id" GIT_BROWSE_REPO_NAME="$repo_name"

    echo "Serving: $server_root"
    echo "Open:    $url"

    "${compose[@]}" up --build -d
    log_debug "Started container for $server_root on port $port (livereload: $livereload_port)"
    
    # Wait for the server to start before opening the browser
    until port_in_use "$port"; do
        sleep 0.5
    done
    log_debug "Server is up on port $port, opening browser..."

    # Open the browser after the server is up
    open_browser "$url"
    log_debug "Browser opened for $url (possibly)"

    trap '"${compose[@]}" stop' INT TERM
    "${compose[@]}" logs -f
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
