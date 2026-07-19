#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")
OUTPUT_DIR="$PROJECT_DIR/docs/screenshots"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

mkdir -p "$OUTPUT_DIR"

render() {
  name=$1
  app=$2
  shift 2
  pixlet render "$PROJECT_DIR/$app" "$@" --output "$TEMP_DIR/$name.webp"
}

scale() {
  source=$1
  destination=$2
  magick "${source}[0]" -filter point -resize 800% "$destination"
}

render landed-prs apps/landed-prs/landed_prs.star
render token-use apps/token-use/token_use.star
render bin-quest apps/bin-quest/bin_quest.star
render control-tower apps/codex-control-tower/control_tower.star \
  live=4 warm=9 jobs=2 needs=0
render glint-working apps/glint/glint.star \
  mode=working working=4 ready=0 completed=0 shipped=0
render billable-week apps/billable-week/billable_week.star \
  week_tenths=339 target_tenths=200 active=0 celebrate=0 session_seconds=0
render exception-screen apps/exception-screen/exception_screen.star \
  count=2 label_1=CI value_1=FAILED severity_1=critical \
  "label_2=PR DATA" value_2=STALE severity_2=warn

pixlet render "$PROJECT_DIR/apps/glint/glint.star" \
  mode=complete working=2 ready=0 completed=1 shipped=0 \
  --gif --output "$TEMP_DIR/glint.gif"

scale "$TEMP_DIR/landed-prs.webp" "$OUTPUT_DIR/landed-prs.png"
scale "$TEMP_DIR/token-use.webp" "$OUTPUT_DIR/token-use.png"
scale "$TEMP_DIR/bin-quest.webp" "$OUTPUT_DIR/bin-quest.png"
scale "$TEMP_DIR/control-tower.webp" "$OUTPUT_DIR/control-tower.png"
scale "$TEMP_DIR/billable-week.webp" "$OUTPUT_DIR/billable-week.png"
scale "$TEMP_DIR/exception-screen.webp" "$OUTPUT_DIR/exception-screen.png"

magick "$TEMP_DIR/glint.gif" -coalesce -filter point -resize 800% \
  -layers Optimize "$OUTPUT_DIR/glint.gif"

magick \
  \( \
    \( "${TEMP_DIR}/control-tower.webp[0]" -bordercolor "#151b25" -border 1 \) \
    \( "${TEMP_DIR}/glint-working.webp[0]" -bordercolor "#151b25" -border 1 \) \
    +append \
  \) \
  \( \
    \( "${TEMP_DIR}/billable-week.webp[0]" -bordercolor "#151b25" -border 1 \) \
    \( "${TEMP_DIR}/exception-screen.webp[0]" -bordercolor "#151b25" -border 1 \) \
    +append \
  \) \
  -append -filter point -resize 800% "$OUTPUT_DIR/hero.png"

echo "README screenshots generated in $OUTPUT_DIR"
