#!/usr/bin/env bash
#
# File: .claude/hooks/stop.sh
#
# AgentVibes Stop Hook - Wrapper that delegates to .agentvibes/
# This hook runs in LITE mode to extract and speak "Audio Summary:" markers
#

# Fix locale warnings
export LC_ALL=C

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Path to mode configuration
MODE_FILE="$PROJECT_ROOT/.agentvibes/config/mode.txt"

# Check if AgentVibes is installed
AGENTVIBES_HOOKS="$PROJECT_ROOT/.agentvibes/hooks"
if [[ ! -d "$AGENTVIBES_HOOKS" ]]; then
  # AgentVibes not installed, exit silently
  exit 0
fi

# Read current mode (default to full if not set)
CURRENT_MODE="full"
if [[ -f "$MODE_FILE" ]]; then
  CURRENT_MODE=$(cat "$MODE_FILE" 2>/dev/null | tr -d '[:space:]')
fi

# Only run stop hook in LITE mode
# (Full mode uses tool calls for TTS, not stop hooks)
if [[ "$CURRENT_MODE" == "lite" ]]; then
  if [[ -f "$AGENTVIBES_HOOKS/stop-lite.sh" ]]; then
    bash "$AGENTVIBES_HOOKS/stop-lite.sh" "$@"
  fi
fi
