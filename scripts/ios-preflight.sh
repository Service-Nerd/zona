#!/usr/bin/env bash
# ios-preflight.sh — run before every commit touching ios/
# Catches the class of errors that cause distribution failures without needing Xcode.
# Exit 1 on any failure so it can be wired into a pre-commit hook.

set -euo pipefail

IOS_DIR="$(cd "$(dirname "$0")/../ios/App" && pwd)"
APP_DIR="$IOS_DIR/App"
WIDGET_DIR="$IOS_DIR/ZonnaWidgetExtension"
PBXPROJ="$IOS_DIR/App.xcodeproj/project.pbxproj"

PASS=0
FAIL=0

ok()   { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL+1)); }

echo ""
echo "=== iOS preflight ==="
echo ""

# ── 1. plist syntax ──────────────────────────────────────────────────────────
echo "1. Plist syntax"

for f in \
  "$APP_DIR/Info.plist" \
  "$APP_DIR/App.entitlements" \
  "$APP_DIR/AppRelease.entitlements" \
  "$APP_DIR/PrivacyInfo.xcprivacy" \
  "$WIDGET_DIR/PrivacyInfo.xcprivacy"
do
  name="$(basename "$f")"
  if [ ! -f "$f" ]; then
    fail "$name — file missing"
  elif plutil -lint "$f" > /dev/null 2>&1; then
    ok "$name is valid XML plist"
  else
    fail "$name is malformed — $(plutil -lint "$f" 2>&1)"
  fi
done

echo ""

# ── 2. Entitlement → required Info.plist keys ────────────────────────────────
echo "2. Entitlement → usage description coverage"

INFO="$APP_DIR/Info.plist"

# Read entitlements from AppRelease (the one used for distribution)
ENTITLEMENTS_FILE="$APP_DIR/AppRelease.entitlements"

check_usage_key() {
  local entitlement="$1"; local info_key="$2"
  if grep -q "$entitlement" "$ENTITLEMENTS_FILE"; then
    if plutil -extract "$info_key" raw "$INFO" > /dev/null 2>&1; then
      ok "$info_key present (required by $entitlement)"
    else
      fail "$info_key MISSING — required because $entitlement entitlement is declared"
    fi
  fi
}

check_usage_key "com.apple.developer.healthkit"       "NSHealthShareUsageDescription"
check_usage_key "com.apple.developer.healthkit"       "NSHealthUpdateUsageDescription"
check_usage_key "com.apple.developer.siri"            "NSSiriUsageDescription"
check_usage_key "com.apple.security.device.camera"    "NSCameraUsageDescription"
check_usage_key "com.apple.security.device.microphone" "NSMicrophoneUsageDescription"
check_usage_key "com.apple.developer.maps"            "NSLocationWhenInUseUsageDescription"
check_usage_key "com.apple.developer.contacts"        "NSContactsUsageDescription"

echo ""

# ── 3. Privacy manifest — required reason APIs ───────────────────────────────
echo "3. Privacy manifests present and declare required APIs"

APP_PRIVACY="$APP_DIR/PrivacyInfo.xcprivacy"
WIDGET_PRIVACY="$WIDGET_DIR/PrivacyInfo.xcprivacy"

for f in "$APP_PRIVACY" "$WIDGET_PRIVACY"; do
  name="$(basename "$(dirname "$f")")/$(basename "$f")"
  if [ ! -f "$f" ]; then
    fail "$name — missing"
  else
    # Must declare at least one NSPrivacyAccessedAPIType
    if plutil -extract "NSPrivacyAccessedAPITypes" raw "$f" > /dev/null 2>&1; then
      ok "$name declares NSPrivacyAccessedAPITypes"
    else
      fail "$name — NSPrivacyAccessedAPITypes not declared"
    fi
    # NSPrivacyTracking must be present
    if plutil -extract "NSPrivacyTracking" raw "$f" > /dev/null 2>&1; then
      ok "$name declares NSPrivacyTracking"
    else
      fail "$name — NSPrivacyTracking not declared"
    fi
    # C617.1 is invalid for group-container UserDefaults — both targets use suiteName
    if grep -q "C617.1" "$f"; then
      fail "$name uses C617.1 — invalid for suiteName/group-container access; use 1C8F.1"
    else
      ok "$name does not contain invalid reason code C617.1"
    fi
  fi
done

echo ""

# ── 4. pbxproj — no duplicate UUIDs ─────────────────────────────────────────
echo "4. pbxproj UUID uniqueness"

# A UUID is "defined" when it appears as the key of an object: leading tabs then UUID then space/slash
# Each UUID should be defined exactly once (may be referenced many times elsewhere — that's fine).
DUPES=$(grep -oE '^\t\t[A-F0-9]{24} ' "$PBXPROJ" | grep -oE '[A-F0-9]{24}' | sort | uniq -d)
if [ -z "$DUPES" ]; then
  ok "No duplicate UUID definitions in project.pbxproj"
else
  fail "Duplicate UUID definitions in project.pbxproj: $DUPES"
fi

echo ""

# ── 5. pbxproj — PrivacyInfo.xcprivacy wired into App target ────────────────
echo "5. PrivacyInfo.xcprivacy wired into Xcode build phases"

if grep -q "PrivacyInfo.xcprivacy in Resources" "$PBXPROJ"; then
  ok "PrivacyInfo.xcprivacy in App Resources build phase"
else
  fail "PrivacyInfo.xcprivacy NOT in App Resources build phase — pbxproj edit required"
fi

if grep -q "PrivacyInfo.xcprivacy.*PBXFileReference" "$PBXPROJ" || grep -q "PBXFileReference.*PrivacyInfo.xcprivacy" "$PBXPROJ"; then
  ok "PrivacyInfo.xcprivacy has a PBXFileReference entry"
else
  fail "PrivacyInfo.xcprivacy has no PBXFileReference entry"
fi

echo ""

# ── 6. capacitor.config.ts — no local dev URL committed ─────────────────────
echo "6. capacitor.config.ts — production URL check"

CAP_CONFIG="$(cd "$(dirname "$0")/.." && pwd)/capacitor.config.ts"
# Strip comment lines before checking — example IPs in comments are fine
if grep -vE '^\s*//' "$CAP_CONFIG" | grep -qE '192\.168\.|localhost|127\.0\.0\.1|0\.0\.0\.0'; then
  fail "Local dev URL found in capacitor.config.ts — do not commit this"
else
  ok "No local dev URL in capacitor.config.ts"
fi

if grep -q "cleartext: false" "$CAP_CONFIG"; then
  ok "cleartext: false (TLS enforced)"
else
  fail "cleartext not set to false in capacitor.config.ts"
fi

echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo "=== Results: $PASS passed, $FAIL failed ==="
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
