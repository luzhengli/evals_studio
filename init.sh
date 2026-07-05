#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

SKIP_BUILD=false
RUN_APP=false
OPEN_APP=false

usage() {
  cat <<'USAGE'
Usage: ./init.sh [--skip-build] [--run] [--open] [--help]

Bootstraps Agent Eval Studio for a fresh agent or developer session.

Default behavior:
  1. Check that Bun is available.
  2. Run bun install.
  3. Run bun run test.
  4. Run bun run build:web.

Options:
  --skip-build  Skip bun run build:web after tests.
  --run         Start the local dev server after verification.
  --open        Open http://localhost:4747 after starting the dev server.
  --help        Show this help text.

Safety:
  This script does not seed, delete, migrate, or reset data.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --run)
      RUN_APP=true
      ;;
    --open)
      OPEN_APP=true
      RUN_APP=true
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Run ./init.sh --help for usage." >&2
      exit 2
      ;;
  esac
done

echo "=== Agent Eval Studio initialization ==="
echo "Root: $ROOT_DIR"

echo
echo "=== Environment checks ==="
if ! command -v bun >/dev/null 2>&1; then
  echo "Bun is required but was not found on PATH." >&2
  exit 1
fi
bun --version

echo
echo "=== Dependency setup ==="
bun install

echo
echo "=== Baseline tests ==="
bun run test

if [[ "$SKIP_BUILD" == false ]]; then
  echo
  echo "=== Web build ==="
  bun run build:web
else
  echo
  echo "Skipping web build because --skip-build was provided."
fi

echo
echo "=== Harness handoff files ==="
echo "Next files to read: CLAUDE.md, progress.md, feature_list.json"

if [[ "$RUN_APP" == true ]]; then
  echo
  echo "=== Starting dev server ==="
  echo "URL: http://localhost:4747"
  if [[ "$OPEN_APP" == true ]]; then
    (sleep 2 && open "http://localhost:4747") &
  fi
  exec bun run dev
fi

echo
echo "=== Environment ready ==="
