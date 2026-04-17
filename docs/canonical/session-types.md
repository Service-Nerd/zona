# Session Types — Canonical Reference

**Authority**: This document is the single source of truth for session type definitions, colour tokens, zone assignments, and HR target ranges. If `session-types.ts` and any other source disagree, this document wins.

---

## Session Type Map

| Type | Label | Colour Token | Hex | Zone | HRR % Range | Notes |
|---|---|---|---|---|---|---|
| `easy` | Easy | `--color-session-easy` | `#4A90D9` | Zone 2 | 60–70% | Conversational effort |
| `run` | Run | `--color-session-easy` | `#4A90D9` | Zone 2 | 60–70% | Generic run; treated same as easy |
| `long` | Long Run | `--color-session-long` | `#7B68EE` | Zone 2 | 60–70% | Extended easy effort |
| `quality` | Quality | `--color-session-quality` | `#F2C14E` | Threshold | 75–85% | Tempo, cruise intervals |
| `tempo` | Tempo | `--color-session-quality` | `#F2C14E` | Threshold | 75–85% | Shares quality colour |
| `intervals` | Intervals | `--color-session-intervals` | `#E05A5A` | VO2max | 85–95% | 400m–800m repeats |
| `hard` | Hard | `--color-session-intervals` | `#E05A5A` | VO2max | 85–95% | Shares intervals colour |
| `race` | Race | `--color-session-race` | `#E8833A` | Race pace | — | Target HR from plan meta |
| `recovery` | Recovery | `--color-session-recovery` | `#5BAD8C` | Zone 1 | <60% | Active recovery only |
| `strength` | Strength | `--color-session-strength` | `#3A506B` | — | — | No HR target. Content stub until R21. |
| `cross-train` | Cross-Train | `--color-session-crosstrain` | `#5BC0BE` | — | — | Bike / swim / gym |
| `rest` | Rest | (none) | — | — | — | No accent colour. No HR target. |

---

## Rules

1. **One owner**: Session type → colour/label/zone logic lives exclusively in `session-types.ts`. No component resolves this independently.
2. **No red**: `#E05A5A` (intervals/hard) is coral, not red. Never use pure red anywhere in ZONA.
3. **Strength stubs**: Strength sessions carry no HR target and no zone until R21. Display as label only.
4. **Rest**: No dot, no accent, no HR display.
5. **HR target fallback chain**: See `docs/canonical/zone-rules.md` — `session.hr_target` → Karvonen → `plan.meta.zone2_ceiling` → show nothing.

## Known Drift — TypeScript Type

The `SessionType` union in `types/plan.ts` currently only includes:

```typescript
'run' | 'easy' | 'quality' | 'strength' | 'rest' | 'race'
```

The full set of types handled by the UI (and defined in this document) also includes: `long`, `tempo`, `intervals`, `hard`, `recovery`, `cross-train`. These are correctly handled by the colour/label maps in `PlanCalendar` and `DashboardClient`, but the TypeScript type is narrower than reality.

**Action required**: Extend `SessionType` in `types/plan.ts` to match this canonical list before any new session type work begins.

---

## CSS Tokens (defined in globals.css)

```css
--color-session-easy:       #4A90D9;
--color-session-long:       #7B68EE;
--color-session-quality:    #F2C14E;
--color-session-intervals:  #E05A5A;
--color-session-race:       #E8833A;
--color-session-recovery:   #5BAD8C;
--color-session-strength:   #3A506B;
--color-session-crosstrain: #5BC0BE;
```
