# API Contract — /api/strength/weekly-note

**Item:** `STRENGTH-NOTE-01` (STRENGTH-ENGINE-01, ADR-024 §6b). **Route:** `app/api/strength/weekly-note/route.ts`.
**Auth:** Bearer token, then `strengthGate` (404 without release access), then `guardAiRequest` (surface
`strength-weekly-note`, default AI rate limit). **Model:** Haiku via `callAnthropic` (logged as `ai_call`).

## POST

```json
{ "week_n": 4 }
```

**200** `{ "note": string | null, "cached"?: true }`.
- Cache first: `strength_plans.weekly_notes[weekNoteKey(week)]`, where the key is `"<week_n>:<hash of the
  week's sessions>"`, so a re-placed week misses and is regenerated.
- On a miss: one Haiku call; the reply passes `parseStrengthNote` (no outcome or injury claim, no prescription,
  no em dash, ≤2 sentences, ≤260 chars) or it is dropped. A kept note is stored; keys for weeks no longer in the
  plan are pruned on the same write.
- ⚠️ **Silent on failure (ADR-006):** a failed call, a refused reply, an unknown week or no plan all answer
  `{ "note": null }` with 200, and nothing is stored. The screen renders nothing.

**422** a non-integer `week_n`. **401 / 404** the gate.
