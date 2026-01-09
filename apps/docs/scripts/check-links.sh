#!/bin/bash
# Link checker for documentation internal links

set -e

# Extract all internal doc links
links=$(grep -roh "](/docs/[^)]*)" content/docs/ 2>/dev/null | sed 's|](/docs/||; s|)||' | sort -u)

errors=0
total=0

echo "Checking internal documentation links..."
echo

while IFS= read -r link; do
  total=$((total + 1))
  # Convert link to file path
  filepath="content/docs/${link}.mdx"

  if [ ! -f "$filepath" ]; then
    echo "❌ BROKEN: /docs/$link -> $filepath"
    errors=$((errors + 1))
  fi
done <<< "$links"

echo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $errors -eq 0 ]; then
  echo "✅ All $total links are valid!"
  exit 0
else
  echo "❌ Found $errors broken links out of $total total"
  exit 1
fi
