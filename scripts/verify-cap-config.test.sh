#!/usr/bin/env bash
# Tests scripts/verify-cap-config.mjs by running THE REAL SCRIPT against
# scratch copies of the generated iOS config, via CAP_CONFIG_PATH.
#
# 🔴 WHY A SHELL SUITE AND NOT A VITEST FILE. The file under test is generated
# AND GITIGNORED, so `git checkout` cannot undo a mutation of it — there is no
# committed version to restore. Mutating a copy is the only safe way to make
# this gate go red, and the copy must be fed to the real script rather than to
# a reimplementation of its logic (a test that asserts against its own copy of
# the rule is the DELOAD-OWNER-01 / tierResolution flaw).
#
# ⚠️ EVERY RED CASE ALSO ASSERTS WHICH ARM FIRED. A gate that goes red for the
# wrong reason is a hollow gate: this repo has shipped a green tick with
# nothing behind it more than once, and a red tick with the wrong cause is the
# same error wearing the other colour.
#
# Both directions: the pristine config must PASS, or every red below proves
# nothing.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/verify-cap-config.mjs"
REAL="$ROOT/ios/App/App/capacitor.config.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

if [ ! -f "$REAL" ]; then
  echo "SKIP — $REAL does not exist (generated + gitignored)."
  echo "Run 'nvm use && npm run sync:ios' first; this suite needs a real config to mutate."
  exit 0
fi

# mutate <name> <node-expression-operating-on-'c'>  -> prints the scratch path
mutate() {
  # NOTE: separate `local` statements on purpose. macOS ships bash 3.2, where
  # `local a="$1" b="$TMP/$a.json"` does NOT see `a` while assigning `b` — and
  # under `set -u` that is a hard error, not an empty string. The first cut of
  # this suite did it on one line, every fixture failed to build, CAP_CONFIG_PATH
  # was then passed EMPTY, the script fell back to the REAL config, and all
  # eleven red cases reported a clean pass. A harness that silently tests the
  # wrong file is worse than no harness.
  local name="$1"
  local expr="$2"
  local out="$TMP/$name.json"
  node -e "
    const fs = require('fs')
    const c = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'))
    $expr
    fs.writeFileSync(process.argv[2], JSON.stringify(c, null, '\t') + '\n')
  " "$REAL" "$out" || { echo "  !! could not build fixture $name" >&2; return 1; }
  echo "$out"
}

# expect <label> <path> <expected-exit> [substring-that-must-appear]
expect() {
  local label="$1"
  local path="$2"
  local want="$3"
  local needle="${4:-}"
  local out rc
  # An empty path means the fixture failed to build. Catch it here: the script
  # treats an empty CAP_CONFIG_PATH as unset and reads the real config, which
  # would turn a broken fixture into a false pass.
  if [ -z "$path" ]; then
    echo "  ✗ $label — fixture was not built (empty path)"
    fail=$((fail + 1))
    return
  fi
  out="$(CAP_CONFIG_PATH="$path" node "$SCRIPT" 2>&1)"
  rc=$?
  if [ "$rc" -ne "$want" ]; then
    echo "  ✗ $label — exit $rc, expected $want"
    echo "$out" | sed 's/^/      /'
    fail=$((fail + 1))
    return
  fi
  if [ -n "$needle" ] && ! printf '%s' "$out" | grep -q -- "$needle"; then
    echo "  ✗ $label — exit $rc as expected, but the reason is wrong (no '$needle')"
    echo "$out" | sed 's/^/      /'
    fail=$((fail + 1))
    return
  fi
  echo "  ✓ $label"
  pass=$((pass + 1))
}

echo "verify-cap-config — both directions"
echo

echo "must PASS:"
cp "$REAL" "$TMP/pristine.json"
expect "the real, freshly synced config" "$TMP/pristine.json" 0 "OK — the generated iOS config"

echo
echo "must FAIL — packageClassList (arm 1 / arm 3):"
expect "a LOCAL plugin wiped, as a raw 'npx cap sync ios' does" \
  "$(mutate drop-local "c.packageClassList = c.packageClassList.filter(x => x !== 'SharedStorePlugin')")" 1 "ARM 1"
expect "SharePlugin absent — the defect measured on 2026-11-05" \
  "$(mutate drop-share "c.packageClassList = c.packageClassList.filter(x => x !== 'SharePlugin')")" 1 "MISSING: SharePlugin"
expect "FilesystemPlugin absent — its twin, same stale file" \
  "$(mutate drop-fs "c.packageClassList = c.packageClassList.filter(x => x !== 'FilesystemPlugin')")" 1 "MISSING: FilesystemPlugin"
expect "a class NSClassFromString cannot resolve" \
  "$(mutate bogus-class "c.packageClassList.push('GhostPlugin')")" 1 "UNEXPECTED: GhostPlugin"
expect "packageClassList missing entirely" \
  "$(mutate no-class-list "delete c.packageClassList")" 1 "ARM 1"

echo
echo "must FAIL — field drift from capacitor.config.ts (arm 2):"
expect "our own host dropped from allowNavigation (ONBOARD-EXIT-01)" \
  "$(mutate drop-host "c.server.allowNavigation = c.server.allowNavigation.filter(h => h !== 'www.zonna.run')")" 1 "server.allowNavigation"
expect "the PushNotifications block absent" \
  "$(mutate drop-push "delete c.plugins.PushNotifications")" 1 ".plugins.PushNotifications"
expect "server.url pointing somewhere else" \
  "$(mutate wrong-url "c.server.url = 'http://192.168.0.9:3000'")" 1 ".server.url"
expect "contentInset flipped back to automatic" \
  "$(mutate inset "c.ios.contentInset = 'automatic'")" 1 ".ios.contentInset"
expect "a key present on disk and not in the .ts (reverse direction)" \
  "$(mutate extra-key "c.android = { path: 'android' }")" 1 "not in capacitor.config.ts"
expect "allowNavigation reordered — a verbatim copy would not be" \
  "$(mutate reorder "c.server.allowNavigation = c.server.allowNavigation.slice().reverse()")" 1 "server.allowNavigation"

echo
echo "must PASS — from the directory Xcode actually runs in:"
# 🔴 THE REVIEW FOUND THIS AND THE ORIGINAL VERIFICATION MISSED IT. The CLI's
# loadConfig() reads process.cwd(); Xcode runs a build phase with cwd =
# ios/App, which has no capacitor.config.ts, so it returned {} and arms 2 and 3
# reported every real field and every real class as drift. A build phase that
# blocks every build is worse than no build phase.
cwd_out="$(cd "$ROOT/ios/App" && node "$SCRIPT" 2>&1)"
cwd_rc=$?
if [ "$cwd_rc" -eq 0 ]; then
  echo "  ✓ cwd = ios/App (the Xcode build-phase cwd)"
  pass=$((pass + 1))
else
  echo "  ✗ cwd = ios/App (the Xcode build-phase cwd) — exit $cwd_rc, expected 0"
  echo "$cwd_out" | sed 's/^/      /'
  fail=$((fail + 1))
fi

wrap_out="$(cd "$ROOT/ios/App" && env -i HOME="$HOME" PATH="/usr/bin:/bin" SRCROOT="$PWD" sh "$ROOT/scripts/xcode-verify-cap-config.sh" 2>&1)"
wrap_rc=$?
if [ "$wrap_rc" -eq 0 ]; then
  echo "  ✓ the Xcode wrapper, stripped environment, cwd = ios/App"
  pass=$((pass + 1))
else
  echo "  ✗ the Xcode wrapper, stripped environment, cwd = ios/App — exit $wrap_rc, expected 0"
  echo "$wrap_out" | sed 's/^/      /'
  fail=$((fail + 1))
fi

echo
echo "must FAIL — unreadable:"
expect "the file absent, as in a fresh checkout" "$TMP/does-not-exist.json" 1 "GENERATED and gitignored"
printf '{ not json' > "$TMP/broken.json"
expect "the file malformed" "$TMP/broken.json" 1 "cannot read"

echo
echo "$((pass + fail)) cases, $fail failure(s)"
[ "$fail" -eq 0 ] || exit 1
