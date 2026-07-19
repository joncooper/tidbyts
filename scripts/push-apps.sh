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

: "${TIDBYT_DEVICE_IDS:?TIDBYT_DEVICE_IDS is required}"
: "${TIDBYT_API_TOKEN:?TIDBYT_API_TOKEN is required}"

"$SCRIPT_DIR/render-apps.sh"

old_ifs=$IFS
IFS=,
for device_id in $TIDBYT_DEVICE_IDS; do
  if [ -z "$device_id" ]; then
    continue
  fi
  pixlet push --api-token "$TIDBYT_API_TOKEN" --background \
    --installation-id landedprs "$device_id" "$PROJECT_DIR/renders/landed-prs.webp"
  pixlet push --api-token "$TIDBYT_API_TOKEN" --background \
    --installation-id tokenuse "$device_id" "$PROJECT_DIR/renders/token-use.webp"
  pixlet push --api-token "$TIDBYT_API_TOKEN" --background \
    --installation-id binquest "$device_id" "$PROJECT_DIR/renders/bin-quest.webp"
done
IFS=$old_ifs
