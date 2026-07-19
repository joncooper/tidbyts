#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")

if [ -f "$PROJECT_DIR/.env.local" ]; then
  set -a
  . "$PROJECT_DIR/.env.local"
  set +a
fi

"$SCRIPT_DIR/render-prototypes.sh"

push_one() {
  device_id=$1
  api_token=$2
  installation_id=$3
  image_path=$4
  if [ -z "$device_id" ]; then
    return
  fi
  if [ -z "$api_token" ]; then
    echo "Missing an API token for the $installation_id device role" >&2
    exit 1
  fi
  pixlet push --api-token "$api_token" --background \
    --installation-id "$installation_id" "$device_id" "$image_path"
}

push_one "${TIDBYT_CONTROL_TOWER_DEVICE_ID:-}" "${TIDBYT_CONTROL_TOWER_API_TOKEN:-${TIDBYT_API_TOKEN:-}}" controltower "$PROJECT_DIR/renders/codex-control-tower.webp"
push_one "${TIDBYT_GLINT_DEVICE_ID:-}" "${TIDBYT_GLINT_API_TOKEN:-${TIDBYT_API_TOKEN:-}}" glint "$PROJECT_DIR/renders/glint.webp"
push_one "${TIDBYT_BILLABLE_WEEK_DEVICE_ID:-}" "${TIDBYT_BILLABLE_WEEK_API_TOKEN:-${TIDBYT_API_TOKEN:-}}" billableweek "$PROJECT_DIR/renders/billable-week.webp"
push_one "${TIDBYT_EXCEPTION_DEVICE_ID:-}" "${TIDBYT_EXCEPTION_API_TOKEN:-${TIDBYT_API_TOKEN:-}}" exceptions "$PROJECT_DIR/renders/exception-screen.webp"
