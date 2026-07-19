#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")

set -a
. "$PROJECT_DIR/.env.local"
. "$PROJECT_DIR/.dev.vars"
set +a

: "${TIDBYTS_API_URL:?TIDBYTS_API_URL is required}"
: "${HOUSEHOLD_TOKEN:?HOUSEHOLD_TOKEN is required}"

printf '%s/bins/#key=%s\n' "${TIDBYTS_API_URL%/}" "$HOUSEHOLD_TOKEN"
