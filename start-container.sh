#!/usr/bin/env sh
set -e

# Ensure git can read the repo even if owned by a different UID on host
git config --global --add safe.directory /var/www

# Execute the server, passing arguments and substituting environment variables
exec node /app/src/server.js "$@" --livereloadport "${LIVERELOAD_PORT:-35729}"
