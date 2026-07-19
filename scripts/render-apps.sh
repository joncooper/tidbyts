#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")
RENDER_DIR="$PROJECT_DIR/renders"

if [ ! -f "$PROJECT_DIR/.env.local" ]; then
  echo "Missing $PROJECT_DIR/.env.local" >&2
  exit 1
fi

set -a
. "$PROJECT_DIR/.env.local"
set +a

: "${TIDBYTS_API_URL:?TIDBYTS_API_URL is required}"
: "${TIDBYTS_READ_TOKEN:?TIDBYTS_READ_TOKEN is required}"

mkdir -p "$RENDER_DIR"

pixlet render "$PROJECT_DIR/apps/landed-prs/landed_prs.star" \
  "api_url=$TIDBYTS_API_URL" "read_token=$TIDBYTS_READ_TOKEN" \
  --output "$RENDER_DIR/landed-prs.webp"
pixlet render "$PROJECT_DIR/apps/token-use/token_use.star" \
  "api_url=$TIDBYTS_API_URL" "read_token=$TIDBYTS_READ_TOKEN" \
  --output "$RENDER_DIR/token-use.webp"
pixlet render "$PROJECT_DIR/apps/bin-quest/bin_quest.star" \
  "api_url=$TIDBYTS_API_URL" "read_token=$TIDBYTS_READ_TOKEN" \
  --output "$RENDER_DIR/bin-quest.webp"
