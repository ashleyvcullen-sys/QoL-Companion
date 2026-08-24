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

# --- .env for Vite -----------------------------------------------------
#
# .env is gitignored, so a clean Xcode Cloud checkout has none. Vite inlines
# import.meta.env.VITE_* at BUILD time, so without this every VITE_ value is
# undefined in the bundle. src/lib/supabase.js calls createClient() at module
# top level, which then throws "supabaseUrl is required." while the bundle is
# still evaluating — before React mounts, so no error boundary can catch it.
# The result is a white screen on launch. That is the bug this fixes.
#
# Values come from Xcode Cloud's own environment variables, set on the
# workflow in App Store Connect. Written before `npm run build` because that
# is when Vite reads them.
echo "=== writing .env from Xcode Cloud environment ==="

missing=""
[ -z "${VITE_SUPABASE_URL:-}" ] && missing="$missing VITE_SUPABASE_URL"
[ -z "${VITE_SUPABASE_ANON_KEY:-}" ] && missing="$missing VITE_SUPABASE_ANON_KEY"

if [ -n "$missing" ]; then
  echo "error: required environment variable(s) not set:$missing" >&2
  echo "       Set them on the workflow in App Store Connect:" >&2
  echo "       Xcode Cloud > Manage Workflows > (workflow) > Environment > Environment Variables" >&2
  echo "       Without them the build produces an app that white-screens on launch." >&2
  exit 1
fi

# Values are never echoed — Xcode Cloud build logs are readable by anyone
# with access to the App Store Connect record.
{
  echo "VITE_SUPABASE_URL=${VITE_SUPABASE_URL}"
  echo "VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}"
  if [ -n "${VITE_REVENUECAT_API_KEY:-}" ]; then
    echo "VITE_REVENUECAT_API_KEY=${VITE_REVENUECAT_API_KEY}"
  fi
} > .env

echo "Wrote .env with $(wc -l < .env | tr -d ' ') variable(s)."
if [ -z "${VITE_REVENUECAT_API_KEY:-}" ]; then
  # Not fatal: RevenueCatContext logs and sets configureError rather than
  # throwing, so the app still starts — purchases just stay unavailable.
  echo "note: VITE_REVENUECAT_API_KEY not set — in-app purchases will be inactive in this build."
fi

echo "=== npm run build ==="
npm run build

# Fail loudly rather than shipping a silently broken bundle. If the value did
# not get inlined, the app would white-screen on launch exactly as before —
# far better to break the build here, where the reason is obvious.
echo "=== verifying Supabase config was inlined into the bundle ==="
if grep -rqF "${VITE_SUPABASE_URL}" dist/assets/*.js; then
  echo "Supabase URL found in the built bundle."
else
  echo "error: the Supabase URL is not present in dist/assets — Vite did not inline it." >&2
  echo "       The resulting app would white-screen on launch. Failing the build." >&2
  exit 1
fi

echo "=== npx cap sync ios ==="
npx cap sync ios

echo "=== ci_post_clone.sh finished successfully ==="
