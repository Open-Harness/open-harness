#!/bin/bash
# Copy all .env files from the original repo to the worktree
# This script runs in the context of the new worktree

CURRENT_DIR=$(pwd)

# Find the main/original repo
# Git worktrees share a common .git directory
GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null)

if [ -z "$GIT_COMMON_DIR" ]; then
  echo "Warning: Not in a git repository"
  exit 0
fi

# The main repo is typically the parent directory of the common .git dir
# But if .git is a file (worktree), we need to find the main worktree differently
if [ -f "$GIT_COMMON_DIR/../.git" ] || [ -d "$GIT_COMMON_DIR/../.git" ]; then
  ORIGINAL_REPO=$(cd "$GIT_COMMON_DIR/.." && pwd)
else
  # Try to get the main worktree from git worktree list
  ORIGINAL_REPO=$(git worktree list 2>/dev/null | grep -v "$CURRENT_DIR" | head -1 | awk '{print $1}' || echo "$(dirname "$GIT_COMMON_DIR")")
fi

# If original repo is the same as current, skip (we're in the main repo)
if [ "$ORIGINAL_REPO" = "$CURRENT_DIR" ]; then
  echo "Already in main repo, skipping env file copy"
  exit 0
fi

# Find all .env files in the original repo (excluding node_modules and .git)
# No maxdepth limit - searches all levels to catch .env files anywhere in the monorepo
find "$ORIGINAL_REPO" -name '.env*' -type f ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/.cursor/*' 2>/dev/null | while read -r envfile; do
  # Get relative path from original repo root
  relpath="${envfile#$ORIGINAL_REPO/}"
  
  # Create directory structure in worktree if needed
  mkdir -p "$(dirname "$relpath")"
  
  # Copy the file
  if cp "$envfile" "$relpath" 2>/dev/null; then
    echo "Copied: $relpath"
  else
    echo "Warning: Failed to copy $relpath"
  fi
done
