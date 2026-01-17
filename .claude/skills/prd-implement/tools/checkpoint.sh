#!/bin/bash
# Create a git checkpoint after implementation
# Usage: ./checkpoint.sh <task-id> <message>

TASK_ID=${1:-"task"}
MESSAGE=${2:-"Implementation checkpoint"}

git add -A
git commit -m "checkpoint($TASK_ID): $MESSAGE"
echo "Checkpoint: $TASK_ID at $(git rev-parse --short HEAD)"
