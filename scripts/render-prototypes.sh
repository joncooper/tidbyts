#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_DIR=$(dirname -- "$SCRIPT_DIR")
SNAPSHOT="$PROJECT_DIR/.local/prototype-status.json"
RENDER_DIR="$PROJECT_DIR/renders"

if [ ! -f "$SNAPSHOT" ]; then
  "$SCRIPT_DIR/run-prototype-collector.sh"
fi

mkdir -p "$RENDER_DIR"

value() {
  jq -r "$1" "$SNAPSHOT"
}

pixlet render "$PROJECT_DIR/apps/codex-control-tower/control_tower.star" \
  "live=$(value '.codex.live // 0')" \
  "warm=$(value '.codex.warm // 0')" \
  "jobs=$(value '.codex.jobs // 0')" \
  "needs=$(value '.codex.needsAttention // 0')" \
  "attention_reason=$(value '.codex.attentionReason // ""')" \
  --output "$RENDER_DIR/codex-control-tower.webp"

pixlet render "$PROJECT_DIR/apps/glint/glint.star" \
  "mode=$(value '.glint.mode // "working"')" \
  "working=$(value '.glint.working // 0')" \
  "ready=$(value '.glint.ready // 0')" \
  "completed=$(value '.glint.completed // 0')" \
  "shipped=$(value '.glint.shipped // 0')" \
  --output "$RENDER_DIR/glint.webp"

pixlet render "$PROJECT_DIR/apps/billable-week/billable_week.star" \
  "week_tenths=$(value '.billable.weekTenths // 0')" \
  "target_tenths=$(value '.billable.targetTenths // 200')" \
  "active=$(value 'if .billable.active then 1 else 0 end')" \
  "celebrate=$(value 'if .billable.celebrateGoal then 1 else 0 end')" \
  "session_seconds=$(value '.billable.sessionSeconds // 0')" \
  --output "$RENDER_DIR/billable-week.webp"

exception_count=$(value '.exceptions | length')
pixlet render "$PROJECT_DIR/apps/exception-screen/exception_screen.star" \
  "count=$exception_count" \
  "label_1=$(value '.exceptions[0].label // ""')" \
  "value_1=$(value '.exceptions[0].value // ""')" \
  "severity_1=$(value '.exceptions[0].severity // "warn"')" \
  "label_2=$(value '.exceptions[1].label // ""')" \
  "value_2=$(value '.exceptions[1].value // ""')" \
  "severity_2=$(value '.exceptions[1].severity // "warn"')" \
  --output "$RENDER_DIR/exception-screen.webp"
