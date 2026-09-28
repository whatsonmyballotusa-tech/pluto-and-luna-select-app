#!/usr/bin/env bash
# One-command release APK build for the Pluto and Luna Select Android app.
#
# Usage: ./build-apk.sh [version]
#   version defaults to 1.0.0; the APK is copied to
#   ./pluto-and-luna-select-v<version>.apk next to this script.
#
# Signing credentials are read from ~/workspace/dog-app/release/keystore.env
# (never committed to git). Required vars:
#   PLS_KEYSTORE        path to the release keystore
#   PLS_STORE_PASSWORD  keystore password
#   PLS_KEY_ALIAS       key alias
#   PLS_KEY_PASSWORD    key password
#
# Network: this sandbox's egress proxy needs auth that Java can't handle,
# so the build starts proxy-forward.py (a local unauthenticated CONNECT
# forwarder on 127.0.0.1:8888) if it isn't already running. Gradle is
# configured (~/.gradle/gradle.properties) to use it.
set -euo pipefail

VERSION="${1:-1.0.0}"
HERE="$(cd "$(dirname "$0")" && pwd)"
RELEASE_DIR="$HOME/workspace/dog-app/release"

export JAVA_HOME="${JAVA_HOME:-$HOME/jdk17}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
GRADLE_BIN="${GRADLE_BIN:-$HOME/gradle/gradle-8.14.3/bin/gradle}"

# Start the egress forwarder if needed.
if ! curl -s -m 3 -o /dev/null http://127.0.0.1:8888/ 2>/dev/null; then
  # Any response (even 502/empty) means the port is live; fall back to a probe.
  if ! (echo > /dev/tcp/127.0.0.1/8888) 2>/dev/null; then
    echo "starting proxy forwarder..."
    nohup python3 "$HERE/proxy-forward.py" 8888 > /tmp/proxy-forward.log 2>&1 &
    sleep 2
  fi
fi

if [ -f "$RELEASE_DIR/keystore.env" ]; then
  # shellcheck disable=SC1090
  set -a; . "$RELEASE_DIR/keystore.env"; set +a
fi

export PLS_KEYSTORE="${PLS_KEYSTORE:-$RELEASE_DIR/pluto-luna-release.jks}"
export PLS_KEY_ALIAS="${PLS_KEY_ALIAS:-pluto-luna}"
if [ -z "${PLS_STORE_PASSWORD:-}" ] || [ -z "${PLS_KEY_PASSWORD:-}" ]; then
  echo "ERROR: PLS_STORE_PASSWORD / PLS_KEY_PASSWORD not set." >&2
  echo "Expected in $RELEASE_DIR/keystore.env (never commit this file)." >&2
  exit 1
fi
if [ ! -f "$PLS_KEYSTORE" ]; then
  echo "ERROR: keystore not found at $PLS_KEYSTORE" >&2
  exit 1
fi
if [ ! -x "$GRADLE_BIN" ]; then
  echo "ERROR: gradle not found at $GRADLE_BIN" >&2
  exit 1
fi

# Keep the native wrapper in sync with capacitor.config.json, then build.
cd "$HERE"
npx cap sync android
cd "$HERE/android"
"$GRADLE_BIN" assembleRelease --no-daemon -q

BUILT="$HERE/android/app/build/outputs/apk/release/app-release.apk"
OUT="$HERE/pluto-and-luna-select-v${VERSION}.apk"
cp "$BUILT" "$OUT"

# Quick sanity: verify the APK signature.
"$ANDROID_HOME/build-tools/35.0.0/apksigner" verify --print-certs "$OUT" | head -3
echo "OK: $OUT"
