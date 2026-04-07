#!/usr/bin/env bash
# security-lint.sh -- Fast pattern-based security checks for CI
# Catches known-bad patterns before code reaches dev branch.
# For deep adversarial review, use scripts/review.sh with Claude Code agents.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
MODULES="$ROOT/modules"
ERRORS=0
WARNINGS=0

error() { echo "❌ ERROR: $1"; ERRORS=$((ERRORS + 1)); }
warn()  { echo "⚠️  WARN:  $1"; WARNINGS=$((WARNINGS + 1)); }
ok()    { echo "✅ OK:    $1"; }

echo "=== OpenDesk Security Lint ==="
echo ""

# 1. Check for internal/ boundary violations (cross-module)
echo "--- Module Boundary Checks ---"
BOUNDARY_VIOLATIONS=$(grep -rn "from '.*\.\./.*internal/" "$MODULES" --include='*.ts' \
  | grep -v '/internal/' \
  | grep -v '\.test\.ts' \
  | grep -v 'node_modules' || true)

# More precise: find imports that cross module boundaries via internal/
CROSS_MODULE=$(grep -rn "from '\.\./\.\./.*internal/" "$MODULES" --include='*.ts' \
  | grep -v '\.test\.ts' || true)

if [ -n "$CROSS_MODULE" ]; then
  warn "Cross-module internal/ imports found (should use index.ts):"
  echo "$CROSS_MODULE" | head -10
  echo ""
else
  ok "No cross-module internal/ imports"
fi

# 2. Check that auth middleware is mounted before routes
echo ""
echo "--- Auth Middleware Ordering ---"
SERVER_FILE="$MODULES/api/internal/server.ts"
if [ -f "$SERVER_FILE" ]; then
  AUTH_LINE=$(grep -n "auth.middleware\|authMiddleware" "$SERVER_FILE" | head -1 | cut -d: -f1 || echo "0")
  ROUTE_LINES=$(grep -n "app.use\|app.get\|app.post\|app.put\|app.patch\|app.delete" "$SERVER_FILE" \
    | grep -v "express.json\|express.static\|health\|auth.middleware\|authMiddleware\|idempotency" \
    | head -5)

  if [ "$AUTH_LINE" = "0" ]; then
    error "No auth middleware found in server.ts"
  else
    EARLY_ROUTES=$(echo "$ROUTE_LINES" | awk -F: -v auth="$AUTH_LINE" '$1 < auth {print}')
    if [ -n "$EARLY_ROUTES" ]; then
      error "Routes mounted BEFORE auth middleware (line $AUTH_LINE):"
      echo "$EARLY_ROUTES"
      echo ""
    else
      ok "All API routes mounted after auth middleware"
    fi
  fi
fi

# 3. Check for hardcoded credentials
echo ""
echo "--- Credential Checks ---"
HARDCODED_CREDS=$(grep -rn "password.*=.*['\"]" "$MODULES" --include='*.ts' \
  | grep -v '\.test\.ts' \
  | grep -v 'process\.env' \
  | grep -v 'passwordHash' \
  | grep -v 'hashPassword' \
  | grep -v '// ' \
  | grep -v 'type\|interface\|schema' || true)

if [ -n "$HARDCODED_CREDS" ]; then
  warn "Possible hardcoded credentials:"
  echo "$HARDCODED_CREDS" | head -5
  echo ""
else
  ok "No hardcoded credentials found in modules"
fi

# Check for dev credentials in env fallbacks
DEV_CREDS=$(grep -rn "process\.env.*||.*['\"].*dev\|process\.env.*||.*['\"].*password\|process\.env.*||.*['\"].*secret" "$MODULES" --include='*.ts' \
  | grep -v '\.test\.ts' || true)

if [ -n "$DEV_CREDS" ]; then
  warn "Dev credential fallbacks in env vars (should fail in production):"
  echo "$DEV_CREDS" | head -5
  echo ""
else
  ok "No dev credential fallbacks"
fi

# 4. Check for AUTH_MODE=dev production guard
echo ""
echo "--- Dev Mode Safety ---"
if grep -q "NODE_ENV.*production.*AUTH_MODE\|AUTH_MODE.*dev.*NODE_ENV.*production" "$MODULES/auth/internal/"*.ts 2>/dev/null; then
  ok "AUTH_MODE=dev has production guard"
else
  DEV_MODE=$(grep -rn "AUTH_MODE.*dev\|mode.*=.*'dev'" "$MODULES/auth/internal/" --include='*.ts' | grep -v '\.test\.ts' || true)
  if [ -n "$DEV_MODE" ]; then
    error "AUTH_MODE=dev exists but has no NODE_ENV=production guard"
  fi
fi

# 5. Check for timing-safe comparisons on secrets
echo ""
echo "--- Cryptographic Checks ---"
UNSAFE_COMPARE=$(grep -rn "!==.*Hash\|!==.*password\|===.*Hash\|===.*password" "$MODULES" --include='*.ts' \
  | grep -v '\.test\.ts' \
  | grep -v 'type\|interface\|if (!password' || true)

if [ -n "$UNSAFE_COMPARE" ]; then
  warn "Possible timing-unsafe secret comparison:"
  echo "$UNSAFE_COMPARE" | head -5
  echo ""
else
  ok "No obvious timing-unsafe comparisons"
fi

# 6. Check files over 200 lines
echo ""
echo "--- File Size Checks ---"
LARGE_FILES=$(find "$MODULES" -name '*.ts' -not -name '*.test.ts' -not -path '*/node_modules/*' \
  -exec awk 'END{if(NR>200) print FILENAME": "NR" lines"}' {} \; 2>/dev/null || true)

if [ -n "$LARGE_FILES" ]; then
  warn "Files over 200 lines:"
  echo "$LARGE_FILES"
  echo ""
else
  ok "All files under 200 lines"
fi

# 7. Check for unprotected WebSocket endpoints
echo ""
echo "--- WebSocket Security ---"
if grep -q "onAuthenticate" "$MODULES/collab/internal/"*.ts 2>/dev/null; then
  ok "Hocuspocus has onAuthenticate hook"
else
  error "No onAuthenticate hook on Hocuspocus WebSocket server"
fi

# Summary
echo ""
echo "=== Summary ==="
echo "Errors:   $ERRORS"
echo "Warnings: $WARNINGS"
echo ""

if [ "$ERRORS" -gt 0 ]; then
  echo "FAILED — $ERRORS error(s) must be fixed before merge"
  exit 1
fi

if [ "$WARNINGS" -gt 0 ]; then
  echo "PASSED with $WARNINGS warning(s)"
  exit 0
fi

echo "PASSED — all checks clean"
