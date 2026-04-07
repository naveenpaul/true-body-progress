#!/usr/bin/env bash
# Local pre-flight checks for an Android EAS build.
# Run this before `eas build --platform android` to catch config/plugin/type
# errors in seconds instead of waiting on the EAS queue.
#
# Usage:
#   ./scripts/check-android-build.sh              # checks only
#   ./scripts/check-android-build.sh --build      # checks + local EAS dev APK build
#   ./scripts/check-android-build.sh --run        # checks + expo run:android (install on device/emulator)

set -euo pipefail

MODE="check"
for arg in "$@"; do
  case "$arg" in
    --build) MODE="build" ;;
    --run)   MODE="run" ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

cd "$(dirname "$0")/.."

step() { printf "\n\033[1;34m==> %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }
fail() { printf "\033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }

step "1/4  expo-doctor (package.json / plugin sanity)"
pnpm dlx expo-doctor || fail "expo-doctor found issues"
ok "expo-doctor passed"

step "2/4  TypeScript"
pnpm type-check || fail "type-check failed"
ok "type-check passed"

step "3/4  Lint"
pnpm lint || fail "lint failed"
ok "lint passed"

step "4/4  expo prebuild --platform android --clean (runs all config plugins)"
pnpm expo prebuild --platform android --clean --no-install || fail "prebuild failed"
ok "prebuild succeeded"

ok "All checks passed"

case "$MODE" in
  build)
    step "Building dev APK locally via EAS (--local)"
    eas build --profile development --platform android --local
    ;;
  run)
    step "Building & installing dev client on device/emulator"
    pnpm expo run:android --variant debug
    ;;
  *)
    printf "\n\033[1;32mSafe to run: eas build --profile development --platform android\033[0m\n"
    printf "Or re-run with \033[1m--build\033[0m (local EAS APK) or \033[1m--run\033[0m (install on device).\n"
    ;;
esac
