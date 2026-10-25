# Runbook — the staged race plan (NO-RUNNER-TURNED-AWAY-01)

**What it is.** A runner whose weekly running is too low for the race they ask for gets a plan for that race: base
building (a walk-run start below 6 km/week), a checkpoint on what they actually ran, then the race block, the half on the
same day, more base building, or a later race. Switched on 2026-10-25.

**It is on by default in code.** `lib/plan/baseBuildOnRamp.ts → onRampEnabled()` returns true unless
`ENABLE_BASE_BUILD_ONRAMP` is `'0'`.

## Switch it off (and back on)

1. Vercel → project `zona` → Settings → Environment Variables.
2. Add `ENABLE_BASE_BUILD_ONRAMP` = `0`, environment **Production**.
3. Redeploy production (Deployments → latest → Redeploy). Env changes only reach a new deployment.
4. To switch back on: delete the variable (or set it to anything but `0`) and redeploy.

Off means a base-volume refusal is answered exactly as before 2026-10-25 (`base_volume` 422 with the §118 get-running
offer). Plans already staged keep working: the checkpoint path does not read the switch.

## What to watch

- `ops_events.plan_staged_for_race`: runners given a staged plan.
- `ops_events.plan_checkpoint_evaluated`: checkpoints reached, with `observed_km`, `door_km`, `options`, `choice`.
- `npx tsx scripts/checkpoint-outcomes.ts`: the measured outcome mix on the synthetic population.

⚠️ Nothing has run on a device. The local harness `/staged-preview` (404 in production) renders the screens with real
engine output.
