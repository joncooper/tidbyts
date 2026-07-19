#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")

if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  echo "Missing $PROJECT_DIR/.env.local" >&2
  exit 1
fi

set -a
. "$PROJECT_DIR/.env.local"
set +a

exec node "$PROJECT_DIR/scripts/collect-usage.mjs" "$@"

