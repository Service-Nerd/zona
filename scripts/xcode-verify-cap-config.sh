#!/bin/sh
# Xcode "Run Script" build phase: fail the iOS build if the generated Capacitor
# config is not what a sync would produce.
#
# 🔴 WHY IT HAS TO BE A BUILD PHASE. ios/App/App/capacitor.config.json is
# generated and gitignored, so no commit hook and no CI job can see it — there
# is nothing in the repo to compare. An Xcode build is the ONLY way a stale
# config reaches a device, which makes this the only moment the check can
# actually bind. Measured 2026-11-05: the file had sat untouched since
# 2026-08-06 with two npm plugins absent and the ONBOARD-EXIT-01 navigation fix
# missing, and every other guard in the repo was green throughout.
#
# ⚠️ NODE RESOLUTION IS THE WHOLE RISK HERE. Xcode runs build phases with a
# stripped environment: nvm is not sourced, so there may be no `node` on PATH
# at all even though the developer has several installed. A phase that cannot
# find node and exits 0 is decoration; one that exits 1 blocks a device build
# for a reason unrelated to drift. So: try hard to find a node, and only fail
# if there genuinely is not one.
set -u

REPO="$(cd "$(dirname "$0")/.." && pwd)"

# Xcode runs build phases with cwd = the .xcodeproj's directory. The node
# script makes itself cwd-independent (it chdirs to the repo root, and refuses
# outright if the CLI resolves a different project root), so this is belt and
# braces rather than the fix — but a build phase is exactly the place to not
# rely on the other end having got it right.
cd "$REPO" || {
  echo "error: [verify-cap-config] cannot cd to $REPO"
  exit 1
}

find_node() {
  # 1. $NODE_BINARY — the convention Capacitor and React Native build phases use
  if [ -n "${NODE_BINARY:-}" ] && [ -x "$NODE_BINARY" ]; then
    echo "$NODE_BINARY"; return 0
  fi
  # 2. whatever is on PATH
  if command -v node >/dev/null 2>&1; then
    command -v node; return 0
  fi
  # 3. the highest nvm-installed version (sort -V, so v9 < v10 is handled)
  if [ -d "$HOME/.nvm/versions/node" ]; then
    v="$(ls "$HOME/.nvm/versions/node" 2>/dev/null | sed 's/^v//' | sort -V | tail -1)"
    if [ -n "$v" ] && [ -x "$HOME/.nvm/versions/node/v$v/bin/node" ]; then
      echo "$HOME/.nvm/versions/node/v$v/bin/node"; return 0
    fi
  fi
  # 4. the usual package-manager locations
  for p in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    [ -x "$p" ] && { echo "$p"; return 0; }
  done
  return 1
}

NODE="$(find_node)" || {
  echo "error: [verify-cap-config] no node binary found, so the Capacitor config could not be verified."
  echo "error: [verify-cap-config] This build phase guards ios/App/App/capacitor.config.json, the file"
  echo "error: [verify-cap-config] that decides which native plugins register at all. Unverified is not OK."
  echo "error: [verify-cap-config] Fix: set NODE_BINARY in this target's build settings to your node path,"
  echo "error: [verify-cap-config] or install node. Run 'nvm which current' to find it."
  exit 1
}

# Capture first, then print. A pipe into sed would lose the exit status (`sh`
# has no PIPESTATUS), and running the check twice to recover it would mean a
# config mutated between the two runs could report the other run's verdict.
log="$(mktemp -t verifycapconfig)"
"$NODE" "$REPO/scripts/verify-cap-config.mjs" >"$log" 2>&1
status=$?
sed 's/^/note: /' "$log"
rm -f "$log"

if [ "$status" -ne 0 ]; then
  echo "error: [verify-cap-config] the generated Capacitor config is stale or wrong (see the notes above)."
  echo "error: [verify-cap-config] Fix: nvm use && npm run sync:ios   (never a raw 'npx cap sync ios')."
  exit 1
fi

exit 0
