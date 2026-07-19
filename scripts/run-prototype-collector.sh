#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")

if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a
  . "$PROJECT_DIR/.env.local"
  set +a
fi

exec node "$PROJECT_DIR/scripts/collect-prototypes.mjs" "$@"
