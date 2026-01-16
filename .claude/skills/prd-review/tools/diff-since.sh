#!/bin/bash
# Show changes since a checkpoint
# Usage: ./diff-since.sh <checkpoint-name>

CHECKPOINT=${1:-"checkpoint"}

# Find the commit hash for this checkpoint
HASH=$(git log --oneline --grep="checkpoint($CHECKPOINT)" --format="%H" | head -1)

if [ -z "$HASH" ]; then
  echo "Checkpoint not found: $CHECKPOINT"
  exit 1
fi

echo "Changes since checkpoint($CHECKPOINT) at $HASH:"
git diff $HASH HEAD
