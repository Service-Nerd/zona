# Native HealthKit ingest — the Xcode steps (HK-NATIVE-BG-INGEST-01)

**Run this on the Mac with Xcode.** The code is written and pushed from a
machine that has no Xcode, so everything below is the part that cannot be done
there.

> 🔴 **What is already verified, and what is not.** `npm run typecheck:ios`
> typechecks both local plugins against the real macOS SDK with only
> `Capacitor` and `UIKit` stubbed, so HealthKit, Security/Keychain,
> async/await, JSON and URLSession usage are checked. **Nothing is checked
> against Capacitor's or UIKit's real API**, iOS-only availability differences
> are invisible, and it is not a link, a build or a run. **Step 2 is the first
> time this code is really compiled.**

## 1. Sync and verify the generated config

```
nvm use                 # .nvmrc — the Capacitor CLI needs Node >= 22
npm run sync:ios        # never a raw `npx cap sync ios`
```

Expect `[verify-cap-config] OK — the generated iOS config is what a sync would
produce now.` If it reports drift, stop and read it: that file decides which
native plugins register at all.

## 2. Open and build

```
npx cap open ios
```

Build the **App** scheme (⌘B). **Nothing needs adding to the target** — the new
code went into `SharedStorePlugin.swift` and `HealthObserverPlugin.swift`,
which are already members. That was deliberate: the App target uses explicit
membership, so a new file would have needed a manual add and forgetting it
fails silently.

⚠️ The first build phase is now **Verify Capacitor config** and it can fail the
build on purpose. If it reports no `node`, set `NODE_BINARY` in the target's
build settings to the output of `nvm which current`.

## 3. No capability or entitlement changes

**Deliberately nothing to do here.** The credential lives in the app's own
Keychain, not a shared access group, precisely so this feature needs no
entitlement edit and no provisioning round-trip. If Xcode offers to add a
Keychain Sharing capability, **decline it** — it is not required and it would
change both entitlement files.

## 4. Bump the build number before any upload

`CURRENT_PROJECT_VERSION` is **15** and has not moved since 2026-08-06. App
Store Connect rejects a duplicate build number.

## 5. On-device smoke (not the simulator)

The simulator cannot exercise background delivery. On a tethered iPhone:

1. Sign in, open the app once, then background it (do **not** force-quit).
2. Record a run on the Watch, or add a running workout in Health.
3. Lock the phone and wait.
4. Re-open the app and check the run is already linked rather than linking as
   you watch.

**What success looks like in the data** — run this after a day or two:

```sql
select count(*) as native_ingests,
       count(distinct user_id) as users,
       min(created_at) as first, max(created_at) as last
from ops_events where kind = 'health_native_ingest';
```

- **Rows appearing** = the native path is alive. This is the single signal that
  distinguishes "built and working" from "built and inert".
- **Zero rows after several runs** = it is not firing. Check, in this order:
  the credential is being written (sign out and back in), `expires_at` is not
  always stale (the token is only published while the app is open), and the
  workout observer is registered (`packageClassList` contains
  `HealthObserverPlugin`).

⚠️ **Zero rows is also the correct result if no run finished within an hour of
the app last being open** — the Phase 1 design has no token refresh, by
design. Of 60 measured runs, 21 would have had a live token. So judge it over
a week, not one run.

## 6. Then re-measure the thing this was built for

Median time-to-link was **2 h 15 m**, with 22% of runs inside a quarter of an
hour. The query is recorded on the backlog item. A fall in the median for runs
that had a live token is the acceptance criterion.
