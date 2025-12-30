#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/release.sh \"commit message\""
  exit 1
fi

COMMIT_MSG="$1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Get current version from package.json
CURRENT_VERSION=$(grep '"version":' "$ROOT_DIR/package.json" | head -1 | sed 's/.*"version": "\([^"]*\)".*/\1/')
echo "Current version: $CURRENT_VERSION"

# Increment patch version
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}
NEW_PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$NEW_PATCH"
echo "New version: $NEW_VERSION"

# Update version in all files
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$ROOT_DIR/package.json"
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$ROOT_DIR/.claude-plugin/plugin.json"
sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" "$ROOT_DIR/.claude-plugin/marketplace.json"

# Stage, commit, and push
cd "$ROOT_DIR"
git add -A
git commit -m "$COMMIT_MSG, bump to $NEW_VERSION"
git push -u origin main 2>/dev/null || git push

echo "Released version $NEW_VERSION"

# Update the installed plugin
echo "Updating installed plugin..."
claude plugin update claudeledger 2>/dev/null && echo "Plugin updated. Restart Claude Code to apply." || echo "Plugin update skipped (not installed or error)"
