#!/bin/bash
# Create a git checkpoint after planning or code changes
# Usage: ./checkpoint.sh <name> <message>

NAME=${1:-"checkpoint"}
MESSAGE=${2:-"Checkpoint"}

git add -A
git commit -m "checkpoint($NAME): $MESSAGE"
echo "Checkpoint: $NAME at $(git rev-parse --short HEAD)"
