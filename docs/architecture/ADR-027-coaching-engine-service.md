# ADR-027: the coaching engine as a layered service (PROPOSED, 2026-11-20)

**Status:** PROPOSED. Awaiting the founder's approval.
**HLD:** `docs/architecture/hld-coaching-engine-service-2026-11-20.html` (published as a private artifact,
https://claude.ai/artifact/HSgFxUU2qhWBbSdMbptN5F).
**Inventory:** `docs/architecture/engine-inventory-2026-11-20.md`.
**Trigger:** `docs/decisions/coaching-2026-11-20-final-plan-read.md`. About 46 new defect classes were found in one
pass. All of them trace to five structural causes, and they meet the founder's stated condition for a new
architecture.

## Decision (proposed)
The engine is rebuilt as a versioned service, structured as six layers. Each layer owns one canonical truth:

| Layer | Owns | Canonical truth |
|---|---|---|
| L1 Profile | Turning raw input into a `RunnerProfile`, including each day's capacity | who the runner is |
| L2 Rule catalogue | Every principle as data, traced to its § | what we believe |
| L3 Planner | Block, then week, then session. One owner of delivered volume. No post-passes. Strength placement lives here too | the delivered plan |
| L4 Explanation | Every note, generated only from decision records | why |
| L5 Verifier | An independent evaluator of the L2 rules over the output | is it right |
| L6 Enrichment | Optional AI copy, re-verified | (none) |

The coaching doctrine is unchanged. Rulings become L2 entries.

## Consequences
- Success is measured by Scorecard v2 on a production-shaped golden corpus.
- The current engine is the baseline. Each plan kind is cut over only in shadow mode, and only when it is at least
  as good on every line.
- Defects are captured automatically:
  - verifier findings on every generation and nightly;
  - a defect register;
  - auto-created backlog items;
  - each new defect becomes a regression fixture;
  - a CI ratchet;
  - automatic regeneration of eligible live plans.
- The current engine is frozen except for a list of hotfixes for defects that harm runners.
- The build order is B0–B8, as set out in the HLD.
