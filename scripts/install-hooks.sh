#!/bin/bash

# Install marplint git hooks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
HOOKS_DIR="$ROOT_DIR/.git/hooks"

echo "📦 Installing marplint git hooks..."

# Create hooks directory if it doesn't exist
mkdir -p "$HOOKS_DIR"

# Install pre-commit hook
cp "$SCRIPT_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "✅ Installed pre-commit hook to $HOOKS_DIR/pre-commit"
echo ""
echo "The hook will run marplint on staged .md files before each commit."
echo ""
echo "To uninstall: rm $HOOKS_DIR/pre-commit"
