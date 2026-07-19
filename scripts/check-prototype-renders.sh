#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")
OUTPUT_DIR="$PROJECT_DIR/renders/qa"

mkdir -p "$OUTPUT_DIR"

pixlet render "$PROJECT_DIR/apps/codex-control-tower/control_tower.star" \
  live=99 warm=99 jobs=99 needs=0 --output "$OUTPUT_DIR/control-normal.webp"
pixlet render "$PROJECT_DIR/apps/codex-control-tower/control_tower.star" \
  live=99 warm=99 jobs=99 needs=99 attention_reason="JOB FAILED" \
  --output "$OUTPUT_DIR/control-attention.webp"

for mode in idle working ready complete celebrate; do
  pixlet render "$PROJECT_DIR/apps/glint/glint.star" \
    "mode=$mode" working=99 ready=99 completed=99 shipped=99 \
    --output "$OUTPUT_DIR/glint-$mode.webp"
done

pixlet render "$PROJECT_DIR/apps/billable-week/billable_week.star" \
  week_tenths=139 target_tenths=200 active=0 celebrate=0 session_seconds=0 \
  --output "$OUTPUT_DIR/billable-under.webp"
pixlet render "$PROJECT_DIR/apps/billable-week/billable_week.star" \
  week_tenths=339 target_tenths=200 active=0 celebrate=0 session_seconds=0 \
  --output "$OUTPUT_DIR/billable-over.webp"
pixlet render "$PROJECT_DIR/apps/billable-week/billable_week.star" \
  week_tenths=200 target_tenths=200 active=0 celebrate=1 session_seconds=0 \
  --output "$OUTPUT_DIR/billable-goal.webp"
pixlet render "$PROJECT_DIR/apps/billable-week/billable_week.star" \
  week_tenths=199 target_tenths=200 active=1 celebrate=0 session_seconds=359999 \
  --output "$OUTPUT_DIR/billable-active.webp"

pixlet render "$PROJECT_DIR/apps/exception-screen/exception_screen.star" \
  count=0 --output "$OUTPUT_DIR/exception-clear.webp"
pixlet render "$PROJECT_DIR/apps/exception-screen/exception_screen.star" \
  count=1 label_1="LONG LABEL" value_1="1234567" severity_1=critical \
  --output "$OUTPUT_DIR/exception-single.webp"
pixlet render "$PROJECT_DIR/apps/exception-screen/exception_screen.star" \
  count=4 label_1="VERYLONGLABEL" value_1="TOOLONGVALUE" severity_1=critical \
  label_2="SECONDALERT" value_2="ALSOOVER" severity_2=warn \
  label_3="THIRD ALERT" value_3="OFFLINE" severity_3=critical \
  label_4="FOURTH" value_4="NO DATA" severity_4=warn \
  --output "$OUTPUT_DIR/exception-stack.webp"

echo "Prototype render checks passed: $OUTPUT_DIR"
