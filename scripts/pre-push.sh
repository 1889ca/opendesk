#!/usr/bin/env bash
# pre-push hook — runs the same checks as CI before pushing.
# Install via: ./scripts/install-hooks.sh
# Mirrors .github/workflows/ci.yml: check, lint, test, build, security-lint.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

echo "=== Pre-push checks (mirrors CI) ==="
echo ""

# 1. TypeScript
echo "--- TypeScript check ---"
npm run check
echo ""

# 2. ESLint
echo "--- ESLint ---"
npm run lint
echo ""

# 3. Tests
echo "--- Tests ---"
npm run test -- --run
echo ""

# 4. Frontend build
echo "--- Frontend build ---"
npm run build:frontend
echo ""

# 5. Security lint
echo "--- Security lint ---"
./scripts/security-lint.sh
echo ""

echo "=== All pre-push checks passed ==="
