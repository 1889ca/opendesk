#!/usr/bin/env bash
# audit.sh -- Run a code quality and security audit via hivemind
#
# Usage:
#   ./scripts/audit.sh                    # Full audit
#   ./scripts/audit.sh --security         # Security-focused audit
#   ./scripts/audit.sh --module collab    # Audit specific module

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
AUDITS_DIR="$ROOT/audits"
SCRIPTS_DIR="$ROOT/scripts"
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
AUDIT_TYPE="full"
TARGET_MODULE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --security) AUDIT_TYPE="security"; shift ;;
    --module)
      if [ $# -lt 2 ] || [ -z "$2" ]; then
        echo "Usage: $0 --module <module-name>"; exit 1
      fi
      if ! echo "$2" | grep -qE '^[A-Za-z0-9_-]+$'; then
        echo "Error: module name '$2' is invalid (allowed: A-Z a-z 0-9 _ -)"; exit 1
      fi
      TARGET_MODULE="$2"; AUDIT_TYPE="module-$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

mkdir -p "$AUDITS_DIR"

# --- Gather codebase state ---

echo "Gathering codebase state..."

RECENT_CHANGES=$(git -C "$ROOT" diff --stat HEAD~5 2>/dev/null || echo "(fewer than 5 commits)")

if [ -n "$TARGET_MODULE" ]; then
  MODULE_LIST="$TARGET_MODULE"
  MODULE_DIR="$ROOT/modules/$TARGET_MODULE"
  if [ ! -d "$MODULE_DIR" ]; then
    echo "Error: module '$TARGET_MODULE' not found at $MODULE_DIR"
    exit 1
  fi
else
  MODULE_LIST=$(ls -1 "$ROOT/modules/")
fi

LINE_COUNTS=""
for mod in $MODULE_LIST; do
  MOD_DIR="$ROOT/modules/$mod"
  if [ -d "$MOD_DIR" ]; then
    COUNT=$(find "$MOD_DIR" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.css' \) -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
    LINE_COUNTS="${LINE_COUNTS}  ${mod}: ${COUNT} lines\n"
  fi
done

TODOS=$(grep -rnE "TODO|FIXME|HACK|XXX" "${MODULE_DIR:-$ROOT/modules/}" --include='*.ts' --include='*.tsx' --include='*.js' 2>/dev/null | head -30 || echo "(none)")

LARGE_FILES=$(find "${MODULE_DIR:-$ROOT/modules/}" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) -exec awk 'END{if(NR>200) print FILENAME": "NR" lines"}' {} \; 2>/dev/null || echo "(none)")

# --- Compose the prompt ---

CONTEXT="OpenDesk codebase state as of ${DATE}.

RECENT CHANGES (last 5 commits):
${RECENT_CHANGES}

MODULES AND LINE COUNTS:
$(echo -e "$LINE_COUNTS")

FILES OVER 200 LINES:
${LARGE_FILES:-none}

TODO/FIXME/HACK ITEMS:
${TODOS}

TECH STACK: TipTap + Yjs (CRDT), Express, PostgreSQL, Zod validation, TypeScript.
ARCHITECTURE: Contracts-first, modular (modules/ directory), no files over 200 lines, no god files."

if [ "$AUDIT_TYPE" = "security" ]; then
  TOPIC="Security audit of the OpenDesk codebase"
  PROMPT_FOCUS="Focus exclusively on security concerns:
- Input validation gaps (especially Zod schema coverage)
- Authentication and authorization bypass risks
- CRDT integrity -- can malicious Yjs updates corrupt shared documents?
- Injection vectors (SQL, XSS, command injection)
- Dependency vulnerabilities and supply chain risks
- Secrets management and environment variable handling
- CORS and CSP configuration
- Rate limiting and denial-of-service vectors"

elif [ -n "$TARGET_MODULE" ]; then
  TOPIC="Audit of the '${TARGET_MODULE}' module in OpenDesk"

  CONTRACT_PATH="$ROOT/contracts/${TARGET_MODULE}/rules.md"
  if [ -f "$CONTRACT_PATH" ]; then
    CONTRACT_CONTENT=$(cat "$CONTRACT_PATH")
    CONTEXT="${CONTEXT}

CONTRACT FOR ${TARGET_MODULE}:
${CONTRACT_CONTENT}"
  fi

  MODULE_FILES=$(find "$ROOT/modules/$TARGET_MODULE" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' \) 2>/dev/null | head -30)
  CONTEXT="${CONTEXT}

FILES IN MODULE:
${MODULE_FILES}"

  PROMPT_FOCUS="Audit this specific module thoroughly:
- Contract compliance: does the implementation match its contract?
- Boundary violations: does it reach into other modules' internals?
- Code quality: dead code, unclear naming, missing error handling
- Security: input validation, auth checks, data sanitization
- Architecture: single responsibility, proper dependency direction
- Technical debt: TODOs, deferred items, known limitations"

else
  TOPIC="Full code quality and security audit of the OpenDesk codebase"
  PROMPT_FOCUS="Run a comprehensive audit covering all areas:

CODE QUALITY:
- Contract compliance across all modules
- Boundary violations between modules
- Files over 200 lines, god files, dead code
- Naming consistency and code clarity

SECURITY:
- Input validation gaps (Zod schema coverage)
- Authentication and authorization bypass risks
- CRDT integrity and malicious update vectors
- Injection vectors (SQL, XSS, command injection)
- Dependency and supply chain risks

ARCHITECTURE:
- Module coupling and dependency direction violations
- Missing error handling and error propagation patterns
- API surface area -- is anything exposed that shouldn't be?

TECHNICAL DEBT:
- TODO/FIXME/HACK comments and their severity
- Deferred items and known limitations
- Test coverage gaps"
fi

echo "Running audit: ${AUDIT_TYPE}"
echo "---"

"$SCRIPTS_DIR/deliberate.sh" "$TOPIC" \
  --mode research \
  --context "${PROMPT_FOCUS}

${CONTEXT}"

# The deliberation script saves to decisions/. Move the output to audits/.
SLUG=$(echo "$TOPIC" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//' | cut -c1-60)
DELIB_FILE="$ROOT/decisions/${DATE}-${SLUG}-deliberation.md"
SUMMARY_FILE="$ROOT/decisions/${DATE}-${SLUG}.md"
AUDIT_FILE="$AUDITS_DIR/${TIMESTAMP}-${AUDIT_TYPE}.md"

# Copy the deliberation output to audits/
if [ -f "$DELIB_FILE" ]; then
  cp "$DELIB_FILE" "$AUDIT_FILE"
  echo ""
  echo "Audit results saved to: $AUDIT_FILE"
fi

if [ -f "$SUMMARY_FILE" ]; then
  echo "Summary template at: $SUMMARY_FILE"
fi
