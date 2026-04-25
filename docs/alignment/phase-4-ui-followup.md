# Phase 4 — Session Card UI Integration (Follow-up Plan)

**Status:** Composer logic shipped (`lib/plan/sessionComposer.ts`); UI integration deferred from R23 rebuild autonomous run — needs browser-in-loop verification + frontend-design skill.

---

## What's done

`lib/plan/sessionComposer.ts` exports `composeSession({ session, catalogueRow?, goalPace? })` returning a `SessionStructure`:

```ts
{
  warmup: { duration_mins, zone, description },
  strides?: { count, duration_secs, description },
  main: { duration_mins, zone, description },
  race_pace_segment?: { duration_pct, pace_target, description },
  cooldown: { duration_mins, zone, description },
  total_duration_mins,
  shape: 'easy_run' | 'long_run' | 'long_run_with_mp' | 'quality_continuous' | ...
}
```

The composer handles every session type (easy, long, quality, shakeout, race, strength, rest), respects `SESSION_FORMAT` (10/80/10 split with 15-min quality warm-up minimum), adds 4×20s strides for quality sessions, and adds an MP segment block for marathon-pace long runs. Backward-compatible: returns null only if no duration can be derived.

**Tested via `npx tsc --noEmit` (clean).**

---

## What still needs doing

### 4.2 — Wire composer into Session Card UI

Files touched:
- `components/SessionCard.tsx` (or wherever the expanded session view lives)
- `components/SessionPopupInner.tsx` if the bottom-sheet uses a separate render path

Required visual hierarchy (per CLAUDE.md "Session Card Layout" + INV-UI-005):

```
─────────────────────────────────────────────
TOP:    Run type · Zone · HR target · Pace · Distance / Duration
        (already exists post-redesign)
─────────────────────────────────────────────
MIDDLE: STRUCTURED DESCRIPTION ← new from composer
        • Warm-up — 15 min Z1→Z2 + 4×20s strides
        • Main set — 5 × 3 min Z4–Z5 / 2 min jog
        • Cool-down — 5 min Z1
─────────────────────────────────────────────
BOTTOM: Coach notes (1–3 bullets, ZONA voice)
        (already exists)
─────────────────────────────────────────────
```

Render rules:
- Use `var(--moss)` accent for the warm-up bar, `var(--s-quality)` (or session-type colour) for the main set, `var(--mute)` for the cool-down. Tap targets per `ui-patterns.md`.
- Strides block appears as a sub-bullet under warm-up only when `structure.strides` is non-null.
- Race-pace segment appears as a sub-bullet under main set only when `structure.race_pace_segment` is non-null. Surface the target pace.
- For shakeouts and rest days, render minimal — composer returns the right `shape` for the UI to switch on.

### 4.3 — Backward compatibility

Legacy plans (pre-R23) may have sessions without `duration_mins`. Composer returns `null` in that case. The UI should fall back to rendering `session.detail` (legacy free-text field) as a single line.

---

## Frontend-design skill required

Per CLAUDE.md and the original R23 rebuild spec:
- Read `/mnt/skills/public/frontend-design/SKILL.md` first
- Produce design rationale referencing `docs/canonical/ui-patterns.md` and brand voice
- Show rationale for approval before coding

Use the prompt template at the bottom of `ui-patterns.md`.

---

## Verification (browser-required)

Test across the user matrix:
- 5K beginner — easy + long sessions only, no strides
- 10K intermediate — quality with VO2max repeats structure
- HM intermediate — quality with HM-pace intervals (race_specific)
- Marathon experienced peak — long run with MP segment block
- 50K — back-to-back-long display (need design decision: how to render a 2-day session?)

Mobile (375px) verification mandatory before close.

---

## Estimated effort

3–4 hours: ~1h design rationale + approval, ~1.5h component changes, ~1h browser smoke + agent-browser journey test.
