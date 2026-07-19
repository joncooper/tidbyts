#!/bin/sh
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

failures=0

run_step() {
  name=$1
  shift
  if "$@"; then
    node "$SCRIPT_DIR/write-refresh-status.mjs" "$name" ok || failures=1
  else
    node "$SCRIPT_DIR/write-refresh-status.mjs" "$name" failed || true
    failures=1
  fi
}

run_step usage "$SCRIPT_DIR/run-usage-collector.sh"
run_step prs "$SCRIPT_DIR/run-pr-collector.sh"
run_step apps "$SCRIPT_DIR/push-apps.sh"
run_step prototypes "$SCRIPT_DIR/run-prototype-collector.sh"
run_step prototypePush "$SCRIPT_DIR/push-prototypes.sh"

exit "$failures"
