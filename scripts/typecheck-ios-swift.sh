#!/usr/bin/env bash
# Typechecks the local iOS Swift plugins WITHOUT Xcode.
#
# 🔴 WHY THIS EXISTS. There is no Xcode on the machine this app is written on
# (the founder builds on a different Mac), so every line of Swift in
# `ios/App/App/` used to be UNVERIFIED until someone opened the project. The
# two local plugins are not decoration — they are the widget bridge and the
# background HealthKit ingest — and a Swift file that does not compile is a
# build that fails on the one machine that can produce a binary.
#
# ⚠️ WHAT MAKES IT POSSIBLE: HealthKit and Security ARE in the macOS SDK that
# ships with Command Line Tools. Only `Capacitor` and `UIKit` are missing, and
# both are stubbed in scripts/ios-swiftcheck/Stubs.swift — signatures only.
#
# ⚠️ WHAT IT THEREFORE DOES NOT PROVE, stated because a green tick here is
# easy to over-read:
#   · nothing is checked against Capacitor's or UIKit's REAL API — a stub that
#     disagrees with the framework passes here and fails in Xcode;
#   · iOS-only availability differences are invisible (it compiles for macOS);
#   · it is not a link, not a build, and not a run on a device.
# It catches the large majority of compile errors, which is the gap it exists
# for — not all of them.
#
# Exit 1 on a typecheck error. Skips (0) only when swiftc is genuinely absent,
# e.g. Linux CI, and says so loudly — a skip is not a pass.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/ios/App/App"
STUBS="$ROOT/scripts/ios-swiftcheck/Stubs.swift"

if ! command -v swiftc >/dev/null 2>&1; then
  echo "[typecheck-ios-swift] SKIPPED — no swiftc on this machine (macOS only)."
  echo "[typecheck-ios-swift] This is a SKIP, not a pass: the Swift is unchecked here."
  exit 0
fi

# 🔴 "IS THERE A SWIFT COMPILER" WAS THE WRONG QUESTION, AND CI ANSWERED YES.
# GitHub's ubuntu runner HAS `swiftc` — what it does not have is the APPLE SDK, and
# `HealthKit` is an Apple framework. So the skip above passed, the typecheck ran, and
# `no such module 'HealthKit'` failed every job. The header two lines up says it out loud
# — *"HealthKit and Security ARE in the macOS SDK"* — a macOS assumption guarded by a
# test for a compiler.
#
# ⚠️ PROBED, NOT INFERRED FROM `uname`. A Mac without Command Line Tools fails the same
# way, and asking the toolchain whether it can see the framework covers both without
# naming an operating system.
PROBE="$(mktemp -d)"
printf 'import HealthKit
' > "$PROBE/probe.swift"
if ! swiftc -typecheck "$PROBE/probe.swift" >/dev/null 2>&1; then
  rm -rf "$PROBE"
  echo "[typecheck-ios-swift] SKIPPED — swiftc is present but the Apple SDK is not"
  echo "[typecheck-ios-swift] (\`import HealthKit\` does not resolve; this is Linux CI or a Mac"
  echo "[typecheck-ios-swift]  without Command Line Tools)."
  echo "[typecheck-ios-swift] This is a SKIP, not a pass: the Swift is UNCHECKED here, and it is"
  echo "[typecheck-ios-swift] checked only by \`npm run verify\` on a Mac before a push."
  exit 0
fi
rm -rf "$PROBE"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp "$STUBS" "$WORK/Stubs.swift"

# ⚠️ THE POPULATION IS A PROPERTY OF THE FILE, NOT A LIST. Every Swift file
# under the app target that declares a Capacitor plugin (`: CAPPlugin`) is
# checked, so the next local plugin is covered on the way in rather than when
# someone remembers to add it here — a hand-written list is correct on the day
# it is typed and silently short afterwards.
#
# ⚠️ WHAT THAT EXCLUDES, named: `AppDelegate.swift`. It is Capacitor's own
# boilerplate and is dense with real UIKit (`UIResponder`, `UIWindow`,
# `ApplicationDelegateProxy`), so stubbing it would mean stubbing half of
# UIKit for a file we do not write. **If AppDelegate is ever edited, this gate
# does not cover that edit** — the first cut of this script did include it and
# produced 17 errors from the stubs rather than from the code, which is a check
# that trains you to ignore it.
shopt -s nullglob
files=()
for f in "$SRC"/*.swift; do
  grep -q ': *CAPPlugin' "$f" && files+=("$f")
done
if [ ${#files[@]} -eq 0 ]; then
  echo "[typecheck-ios-swift] no Capacitor plugin sources found under $SRC — that is itself wrong."
  exit 1
fi

for f in "${files[@]}"; do
  # Strip only the two imports the macOS SDK cannot satisfy, and re-add
  # Foundation: UIKit re-exports it, so removing the import alone loses `Data`,
  # `URL` and `NotificationCenter` and buries real errors in noise.
  { echo 'import Foundation'; sed -E '/^import (Capacitor|UIKit)$/d' "$f"; } > "$WORK/$(basename "$f")"
done

echo "[typecheck-ios-swift] typechecking $((${#files[@]})) file(s) against $(swiftc --version | head -1)"
if swiftc -typecheck "$WORK"/*.swift; then
  echo "[typecheck-ios-swift] OK — Capacitor and UIKit stubbed; see this script's header for what that does not prove."
  exit 0
fi
echo "[typecheck-ios-swift] FAILED — fix before handing the project to Xcode."
exit 1
