#!/bin/bash

# Xcode Cloud runs this automatically after cloning the repo and before
# building. It exists because node_modules is (correctly) gitignored, so
# a fresh clone has none of the Capacitor plugins that CapApp-SPM/Package.swift
# references by local path (../../../node_modules/@capacitor/...) — without
# this, Swift Package Manager can't resolve those packages and the archive
# fails before it even starts compiling.
#
# Docs: https://developer.apple.com/documentation/xcode/writing-custom-build-scripts

set -e
set -o pipefail

echo "=== ci_post_clone.sh starting ==="

# Xcode Cloud sets CI_WORKSPACE to the cloned repo root. Fall back to a path
# computed from this script's own location (three levels up from
# ios/App/ci_scripts/) so this still works if run manually to test.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${CI_WORKSPACE:-$(cd "$SCRIPT_DIR/../../.." && pwd)}"

cd "$REPO_ROOT"
echo "Project root: $(pwd)"

if [ ! -f package.json ]; then
  echo "error: package.json not found at $REPO_ROOT — is CI_WORKSPACE correct?" >&2
  exit 1
fi

# --- Node.js: use it if the image already has it, else install via Homebrew ---
if command -v node >/dev/null 2>&1; then
  echo "Node.js already available: $(node -v)"
else
  echo "Node.js not found in this image — installing via Homebrew"
  if ! command -v brew >/dev/null 2>&1; then
    echo "error: Homebrew isn't available in this Xcode Cloud image; can't install Node." >&2
    exit 1
  fi
  brew install node
fi

echo "Using node: $(command -v node) ($(node -v))"
echo "Using npm:  $(command -v npm) ($(npm -v))"

echo "=== npm install ==="
npm install

echo "=== npm run build ==="
npm run build

echo "=== npx cap sync ios ==="
npx cap sync ios

echo "=== ci_post_clone.sh finished successfully ==="
