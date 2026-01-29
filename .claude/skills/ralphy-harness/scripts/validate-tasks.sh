#!/usr/bin/env bash
# Validate tasks.yaml against constitution.md
# Usage: ./validate-tasks.sh [tasks.yaml] [constitution.md]

set -euo pipefail

TASKS="${1:-.ralphy/tasks.yaml}"
CONSTITUTION="${2:-.ralphy/constitution.md}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

MUST_VIOLATIONS=0
SHOULD_VIOLATIONS=0

echo "Validating $TASKS against $CONSTITUTION"
echo "=========================================="

# Extract grep patterns from constitution
extract_patterns() {
    local section="$1"
    local file="$2"
    # Find section and extract patterns (lines starting with - `)
    awk "/$section/,/^## /{print}" "$file" | grep -E '^\s*-\s*`' | sed 's/.*`\([^`]*\)`.*/\1/'
}

# Check for MUST violations
echo -e "\n${RED}Checking MUST rules...${NC}"
while IFS= read -r pattern; do
    if [ -n "$pattern" ]; then
        matches=$(grep -n "$pattern" "$TASKS" 2>/dev/null || true)
        if [ -n "$matches" ]; then
            echo -e "${RED}BLOCK: Pattern '$pattern' found:${NC}"
            echo "$matches" | head -5
            ((MUST_VIOLATIONS++))
        fi
    fi
done < <(extract_patterns "## MUST Rules" "$CONSTITUTION")

# Check built-in always_block patterns
for pattern in "That's OK for" "mock harness" "acceptable.*mock" "skip.*test" "TODO.*later"; do
    matches=$(grep -n "$pattern" "$TASKS" 2>/dev/null || true)
    if [ -n "$matches" ]; then
        echo -e "${RED}BLOCK: Built-in pattern '$pattern' found:${NC}"
        echo "$matches" | head -5
        ((MUST_VIOLATIONS++))
    fi
done

# Check for SHOULD violations
echo -e "\n${YELLOW}Checking SHOULD rules...${NC}"
while IFS= read -r pattern; do
    if [ -n "$pattern" ]; then
        matches=$(grep -n "$pattern" "$TASKS" 2>/dev/null || true)
        if [ -n "$matches" ]; then
            echo -e "${YELLOW}WARN: Pattern '$pattern' found:${NC}"
            echo "$matches" | head -3
            ((SHOULD_VIOLATIONS++))
        fi
    fi
done < <(extract_patterns "## SHOULD Rules" "$CONSTITUTION")

# Check built-in always_warn patterns
for pattern in "for now" "verify it works" "should work" "might need"; do
    matches=$(grep -n "$pattern" "$TASKS" 2>/dev/null || true)
    if [ -n "$matches" ]; then
        echo -e "${YELLOW}WARN: Built-in pattern '$pattern' found:${NC}"
        echo "$matches" | head -3
        ((SHOULD_VIOLATIONS++))
    fi
done

# Summary
echo ""
echo "=========================================="
if [ "$MUST_VIOLATIONS" -gt 0 ]; then
    echo -e "${RED}BLOCKED: $MUST_VIOLATIONS MUST violation(s)${NC}"
    echo "Fix violations before running."
    exit 1
elif [ "$SHOULD_VIOLATIONS" -gt 0 ]; then
    echo -e "${YELLOW}PROCEED WITH CAUTION: $SHOULD_VIOLATIONS SHOULD warning(s)${NC}"
    exit 0
else
    echo -e "${GREEN}PASSED: No violations found${NC}"
    exit 0
fi
