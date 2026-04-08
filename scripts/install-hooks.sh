#!/usr/bin/env bash
# Install git hooks for OpenDesk development.
# Run once after cloning: ./scripts/install-hooks.sh

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$ROOT/.git/hooks"

echo "Installing git hooks..."

# Pre-push hook
ln -sf "$ROOT/scripts/pre-push.sh" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"
echo "  Installed pre-push hook"

echo "Done. Hooks installed in $HOOKS_DIR"
