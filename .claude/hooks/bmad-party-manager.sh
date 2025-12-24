#!/usr/bin/env bash
#
# File: .claude/hooks/bmad-party-manager.sh
#
# AgentVibes - Finally, your AI Agents can Talk Back! Text-to-Speech WITH personality for AI Assistants!
# Website: https://agentvibes.org
# Repository: https://github.com/paulpreibisch/AgentVibes
#
# Co-created by Paul Preibisch with Claude AI
# Copyright (c) 2025 Paul Preibisch
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# DISCLAIMER: This software is provided "AS IS", WITHOUT WARRANTY OF ANY KIND,
# express or implied, including but not limited to the warranties of
# merchantability, fitness for a particular purpose and noninfringement.
# In no event shall the authors or copyright holders be liable for any claim,
# damages or other liability, whether in an action of contract, tort or
# otherwise, arising from, out of or in connection with the software or the
# use or other dealings in the software.
#
# ---
#
# @fileoverview BMAD Party Mode Voice Integration Manager
# @context Controls auto-enable/disable of multi-agent voice switching during BMAD party mode
# @architecture Opt-out flag management, auto-detection, status reporting
# @dependencies .bmad/_cfg/agent-manifest.csv, bmad-voices-enabled.flag, user-prompt-output.sh
# @entrypoints /agent-vibes:bmad-party slash command
# @patterns Auto-enable with opt-out, graceful degradation, feature detection
# @related user-prompt-output.sh, bmad-voice-manager.sh, Issue #33

# Fix locale warnings
export LC_ALL=C

PLUGIN_DIR=".claude/plugins"
DISABLE_FLAG="$PLUGIN_DIR/bmad-party-mode-disabled.flag"
BMAD_VOICES_FLAG="$PLUGIN_DIR/bmad-voices-enabled.flag"
BMAD_MANIFEST=".bmad/_cfg/agent-manifest.csv"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

#
# @function is_bmad_installed
# @context Check if BMAD v6 is installed
# @returns 0=installed, 1=not installed
#
is_bmad_installed() {
  [[ -f "$BMAD_MANIFEST" ]]
}

#
# @function is_bmad_voices_enabled
# @context Check if BMAD voice plugin is enabled
# @returns 0=enabled, 1=disabled
#
is_bmad_voices_enabled() {
  [[ -f "$BMAD_VOICES_FLAG" ]]
}

#
# @function is_party_mode_enabled
# @context Check if party mode voice integration is enabled
# @returns 0=enabled, 1=disabled
#
is_party_mode_enabled() {
  # Disabled if opt-out flag exists
  [[ -f "$DISABLE_FLAG" ]] && return 1

  # Enabled if BMAD + voice plugin active
  is_bmad_installed && is_bmad_voices_enabled
}

#
# @function show_status
# @context Display current party mode voice integration status
#
show_status() {
  echo -e "${CYAN}🎭 BMAD Party Mode Voice Integration${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Check BMAD installation
  if ! is_bmad_installed; then
    echo -e "${RED}❌ BMAD not installed${NC}"
    echo -e "${GRAY}   Party mode voice integration requires BMAD v6${NC}"
    echo -e "${GRAY}   Install: https://github.com/bmad-method/bmad${NC}"
    echo ""
    return 1
  fi

  echo -e "${GREEN}✅ BMAD v6 detected${NC}"

  # Check voice plugin
  if ! is_bmad_voices_enabled; then
    echo -e "${RED}❌ BMAD voice plugin disabled${NC}"
    echo -e "${GRAY}   Enable: /agent-vibes:bmad enable${NC}"
    echo ""
    return 1
  fi

  echo -e "${GREEN}✅ BMAD voice plugin enabled${NC}"

  # Check party mode status
  if is_party_mode_enabled; then
    echo -e "${GREEN}✅ Party mode voices: ENABLED${NC}"
    echo ""
    echo -e "${CYAN}How it works:${NC}"
    echo "  When you run /bmad:core:workflows:party-mode,"
    echo "  each agent speaks with their unique voice:"
    echo ""
    echo "  🏗️  Winston (Architect) → Michael"
    echo "  📋 John (PM) → Jessica Anne Bogart"
    echo "  💻 Amelia (Dev) → Matthew Schmitz"
    echo "  📊 Mary (Analyst) → kristin"
    echo "  ... and more!"
    echo ""
    echo -e "${GRAY}Disable with: /agent-vibes:bmad-party disable${NC}"
  else
    echo -e "${YELLOW}⚠️  Party mode voices: DISABLED (opt-out active)${NC}"
    echo ""
    echo -e "${GRAY}Enable with: /agent-vibes:bmad-party enable${NC}"
  fi

  echo ""
}

#
# @function enable_party_mode
# @context Enable party mode voice integration (remove opt-out flag)
#
enable_party_mode() {
  # Verify prerequisites
  if ! is_bmad_installed; then
    echo -e "${RED}❌ Cannot enable: BMAD not installed${NC}"
    echo -e "${GRAY}   Install BMAD v6 first${NC}"
    return 1
  fi

  if ! is_bmad_voices_enabled; then
    echo -e "${RED}❌ Cannot enable: BMAD voice plugin disabled${NC}"
    echo -e "${GRAY}   Enable with: /agent-vibes:bmad enable${NC}"
    return 1
  fi

  # Remove opt-out flag if it exists
  if [[ -f "$DISABLE_FLAG" ]]; then
    rm -f "$DISABLE_FLAG"
    echo -e "${GREEN}✅ Party mode voices enabled${NC}"
    echo ""
    echo -e "${CYAN}🎭 Multi-agent voice switching activated!${NC}"
    echo "   Run /bmad:core:workflows:party-mode to hear agents speak"
  else
    echo -e "${GREEN}✅ Party mode voices already enabled${NC}"
    echo ""
    echo -e "${GRAY}(Auto-enabled when BMAD detected)${NC}"
  fi

  echo ""
}

#
# @function disable_party_mode
# @context Disable party mode voice integration (create opt-out flag)
#
disable_party_mode() {
  mkdir -p "$PLUGIN_DIR"

  if [[ -f "$DISABLE_FLAG" ]]; then
    echo -e "${YELLOW}⚠️  Party mode voices already disabled${NC}"
    return 0
  fi

  # Create opt-out flag
  touch "$DISABLE_FLAG"

  echo -e "${GREEN}✅ Party mode voices disabled${NC}"
  echo ""
  echo -e "${GRAY}Party mode will continue to work, but agents won't speak${NC}"
  echo -e "${GRAY}Enable again with: /agent-vibes:bmad-party enable${NC}"
  echo ""
}

# Main command dispatcher
case "${1:-status}" in
  enable)
    enable_party_mode
    ;;
  disable)
    disable_party_mode
    ;;
  status)
    show_status
    ;;
  *)
    echo -e "${CYAN}AgentVibes BMAD Party Mode Manager${NC}"
    echo ""
    echo "Usage: bmad-party-manager.sh {enable|disable|status}"
    echo ""
    echo "Commands:"
    echo "  enable     Enable party mode voice integration"
    echo "  disable    Disable party mode voice integration (opt-out)"
    echo "  status     Show current status and configuration"
    echo ""
    echo "Party Mode Voice Integration:"
    echo "  • Auto-enabled when BMAD v6 detected"
    echo "  • Each agent speaks with unique voice during party mode"
    echo "  • Opt-out available via disable command"
    ;;
esac
