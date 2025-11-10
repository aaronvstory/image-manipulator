#!/bin/bash

# Enhanced Statusline: Project info, Claude Flow metrics, conditional Swarm (ruv-swarm), conditional Servers (.env only)
# Handles stdin JSON properly for MODEL/CWD; fallbacks for WSL/cc env

# Read full stdin JSON non-consumingly (fixes empty INPUT bug)
read -d '' INPUT < <(cat)

# Parse JSON with fallbacks (jq safe; defaults if fail/missing)
MODEL=$(echo "$INPUT" | jq -r '.model.display_name // empty' 2>/dev/null || echo "Claude")
CWD=$(echo "$INPUT" | jq -r '.workspace.current_dir // .cwd // empty' 2>/dev/null || echo "$PWD")
DIR=$(basename "$CWD" 2>/dev/null || echo "unknown")
BRANCH=$(git -C "$CWD" symbolic-ref --short HEAD 2>/dev/null || echo "detached")
GIT_STATUS=$(git -C "$CWD" status --porcelain 2>/dev/null | wc -l)
GIT_STATUS_SYMBOL=""
if [ "$GIT_STATUS" -gt 0 ]; then
  GIT_STATUS_SYMBOL=" ± CHG: $GIT_STATUS"
else
  GIT_STATUS_SYMBOL=" ✓ SYNCED"
fi

# Line 1: Model + Path + Branch + Git (bold model, cyan path, yellow branch, red/green git)
printf "\033[1m%s\033[0m in \033[36m%s\033[0m on \033[33m⎇ %s\033[0m \033[90m│\033[0m \033[%sm%s\033[0m\n" \
  "$MODEL" "$DIR" "$BRANCH" "$( [ "$GIT_STATUS" -gt 0 ] && echo 31 || echo 32 )" "$GIT_STATUS_SYMBOL"

# Line 2: Hive Mind (live query) or Claude Flow fallback
if command -v npx &>/dev/null && [ -d "$CWD/.hive-mind" ]; then
  # Query live Hive Mind status
  HIVE_JSON=$(npx --yes claude-flow@alpha hive-mind status --json 2>/dev/null || echo "{}")

  SWARM_COUNT=$(echo "$HIVE_JSON" | jq -r '.swarms | length // 0' 2>/dev/null || echo "0")
  AGENT_COUNT=$(echo "$HIVE_JSON" | jq -r '[.swarms[].agents | length] | add // 0' 2>/dev/null || echo "0")
  MAX_AGENTS=$(echo "$HIVE_JSON" | jq -r '.swarms[0].maxAgents // 5' 2>/dev/null || echo "5")
  TOPOLOGY=$(echo "$HIVE_JSON" | jq -r '.swarms[0].topology // "none"' 2>/dev/null || echo "none")

  if [ "${SWARM_COUNT:-0}" -gt 0 ]; then
    # Active swarm: show real data
    printf "Hive Mind │ 🐝 Swarms: %s │ 👥 Agents: %s/%s │ 🔄 Topology: %s\n" \
      "$SWARM_COUNT" "$AGENT_COUNT" "$MAX_AGENTS" "$TOPOLOGY"
  else
    # Hive-mind exists but idle
    printf "Hive Mind │ 🐝 Idle (0 swarms) │ Ready to spawn\n"
  fi
else
  # No hive-mind: fall back to Claude Flow metrics from stdin
  MEM=$(echo "$INPUT" | jq -r '.claude_flow.memory_usage_percent // "N/A"' 2>/dev/null || echo "?")
  CPU=$(echo "$INPUT" | jq -r '.claude_flow.cpu_usage_percent // "N/A"' 2>/dev/null || echo "?")
  SUC=$(echo "$INPUT" | jq -r '.claude_flow.success_rate // "N/A"' 2>/dev/null || echo "?")
  AVG=$(echo "$INPUT" | jq -r '.claude_flow.avg_response_time // "N/A"' 2>/dev/null || echo "?")
  STR=$(echo "$INPUT" | jq -r '.claude_flow.stream_count // 1' 2>/dev/null || echo "1")

  printf "Claude Flow │ 💾 MEM: %s%% ⚙ CPU: %s%% 🎯 SUC: %s%% ⏱️ AVG: %ss 🔥 STR: %s\n" \
    "$MEM" "$CPU" "$SUC" "$AVG" "$STR"
fi

# Line 4: Servers (conditional: only if .env exists in CWD)
if [ -f "$CWD/.env" ]; then
  FE_PORT="3030"
  BE_PORT="3003"
  # Read ports from .env if present
  FE_PORT_FROM_ENV=$(grep "^FRONTEND_PORT=" "$CWD/.env" 2>/dev/null | cut -d'=' -f2-)
  BE_PORT_FROM_ENV=$(grep "^BACKEND_PORT=" "$CWD/.env" 2>/dev/null | cut -d'=' -f2-)
  [ -n "$FE_PORT_FROM_ENV" ] && FE_PORT="$FE_PORT_FROM_ENV"
  [ -n "$BE_PORT_FROM_ENV" ] && BE_PORT="$BE_PORT_FROM_ENV"
  # Check running (lsof for TCP LISTEN)
  FE_RUNNING=$(lsof -i ":$FE_PORT" -sTCP:LISTEN 2>/dev/null | tail -n +2 | wc -l)
  BE_RUNNING=$(lsof -i ":$BE_PORT" -sTCP:LISTEN 2>/dev/null | tail -n +2 | wc -l)
  # Build status (green ✓ if running, red ✗ else)
  if [ "$FE_RUNNING" -gt 0 ]; then
    FE_STATUS="\033[32m⚡ FE: $FE_PORT ✓\033[0m"
  else
    FE_STATUS="\033[36m⚡ FE: $FE_PORT\033[0m \033[31m✗\033[0m"
  fi
  if [ "$BE_RUNNING" -gt 0 ]; then
    BE_STATUS="\033[32m🔌 BE: $BE_PORT ✓\033[0m"
  else
    BE_STATUS="\033[35m🔌 BE: $BE_PORT\033[0m \033[31m✗\033[0m"
  fi
  printf "Servers │  $BE_STATUS  $FE_STATUS\n"
fi
