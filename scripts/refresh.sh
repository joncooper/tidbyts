#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

"$SCRIPT_DIR/run-usage-collector.sh"
"$SCRIPT_DIR/run-pr-collector.sh"
"$SCRIPT_DIR/run-prototype-collector.sh"
"$SCRIPT_DIR/push-apps.sh"
"$SCRIPT_DIR/push-prototypes.sh"
