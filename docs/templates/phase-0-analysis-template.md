# Phase 0 Analysis — {Feature Name}

> **Purpose:** Before any implementation code is written, this document 
> captures what exists, what conflicts, what we'll build, and how we'll 
> phase it. No code is written until this analysis is approved.
>
> **Rule:** If a section is genuinely N/A, write "N/A — {reason}". 
> Never leave a section blank. Blank means it wasn't thought about.

---

## 0. Metadata

| Field | Value |
|---|---|
| Feature name | |
| Author (Claude session) | |
| Date | |
| Related brief / ticket | |
| Rule engine version at time of analysis | |
| Estimated total effort | S / M / L / XL |
| Recommended classification | New build / Enhancement / Rework / Refactor-then-build |

---

## 1. Feature Summary

**What we're building (2–3 sentences, plain language):**

**The single most important outcome for the user:**

**How this feature earns its place in the paid tier:**

**The brand test — does this feature pass "Slow down. You're not Kipchoge."?**
- [ ] Honest, not cheerleading
- [ ] Treats overtraining as failure, not achievement
- [ ] User is treated as an adult
- [ ] No motivational clichés in copy
- [ ] Holds up a mirror rather than handing out gold stars

Any failed checks must be resolved before Phase 1 begins.

---

## 2. Existing Codebase Audit

### 2.1 Surface area touched

List every file, module, table, or service this feature will read from, 
write to, or modify.

| Path | Role | Read / Write / Modify |
|---|---|---|
| | | |

### 2.2 What already exists that relates to this feature

Describe existing functionality, patterns, or data that overlap with 
what we're building. Be specific — link to files and line ranges.

### 2.3 Reusable components

What can we reuse rather than rebuild? List utilities, services, 
models, UI components, prompt patterns, and rules.

| Component | Location | Why it's reusable | Changes needed |
|---|---|---|---|
| | | | |

### 2.4 Existing rules / thresholds that relate

If the rule engine already has rules that touch this feature's domain, 
list them. We need to know what might conflict or compound.

| Rule ID / Name | Current threshold | Where it fires | Conflict risk |
|---|---|---|---|

---

## 3. Conflicts & Technical Debt

### 3.1 Direct conflicts

What in the existing code conflicts with this feature's requirements? 
Be blunt. Old logic, deprecated fields, competing sources of truth, 
rules that would double-fire.

### 3.2 Debt that must be addressed first

What needs refactoring before we can cleanly build this? Distinguish 
between "must fix" and "should fix" — we only do "must fix" in this 
feature's scope.

| Debt item | Must / Should | Estimated impact if deferred |
|---|---|---|

### 3.3 Decisions that should be revisited

Any prior architectural choices this feature exposes as wrong or 
limiting? Flag them now, even if we don't fix them here. Add an 
ADR stub in `/docs/adr/` for each.

---

## 4. Recommended Approach

### 4.1 Classification & rationale

Which of the following, and why?
- **New build** — no meaningful existing surface area
- **Enhancement** — extend existing modules without breaking contracts
- **Rework** — significant replacement of existing logic; migration required
- **Refactor-then-build** — existing code must be restructured before the 
  feature can be added cleanly

### 4.2 Architecture sketch

High-level description of how this feature fits into the system. 
Where does the rule engine run? Where does AI enrichment sit? What 
talks to what?

```
[ASCII diagram or bullet-point flow here — one diagram, not five]
```

### 4.3 Data model changes

New tables, new columns, migrations needed. Reference 
`/docs/architecture/data-model.md` for existing shape.

### 4.4 Rule engine changes

New rules, modified thresholds, new versions. Every rule needs:
- ID and name
- Trigger condition
- Output
- Version it's introduced in
- Reasoning (why this threshold, not another)

### 4.5 AI enrichment changes

New prompts, modified prompts, new few-shot examples. Reference 
`/docs/ai-prompts/` for existing prompts.

### 4.6 UI changes

Summary only at this stage. Full design work happens in the UI phase 
using the `frontend-design` skill.

- Screens affected
- New components needed
- Existing components reused
- Brand-voice copy checkpoints

---

## 5. Risks & Open Questions

### 5.1 Technical risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| | L/M/H | L/M/H | |

### 5.2 Brand / UX risks

Where could this feature drift toward cheerleading, gamification, or 
anything that conflicts with Zonna's voice? How do we prevent it?

### 5.3 Commercial risks

Is this feature defensible as paid? Could a free-tier user feel the 
gating is mean rather than fair? Flag anything that smells wrong.

### 5.4 Open questions for the user

Numbered list. Each question is focused, answerable, and blocking 
or non-blocking clearly marked.

1. **[BLOCKING]** …
2. **[NON-BLOCKING]** …

---

## 6. Proposed Phasing

Each phase must be independently shippable or independently testable. 
No phase runs longer than ~1 week of work.

### Phase 1 — {title}
- **Goal:**
- **Scope:**
- **Out of scope:**
- **Acceptance criteria:**
- **Docs to update:**

### Phase 2 — {title}
- **Goal:**
- **Scope:**
- **Out of scope:**
- **Acceptance criteria:**
- **Docs to update:**

*(Add phases as needed — 3 to 5 is the usual range)*

### Final phase — Telemetry, edge cases, admin tooling
- **Goal:** make this feature observable and supportable in prod
- **Scope:**
  - Metrics to instrument
  - Error states and fallbacks
  - Admin / debug views (if any)
  - Dashboards or alerts

---

## 7. Success Metrics

How will we know this feature works, not just technically, but for the user?

| Metric | Target | How we measure | Review cadence |
|---|---|---|---|
| | | | |

Include at least one **leading** metric (behavioural — are users 
actually changing behaviour?) and one **lagging** metric (outcome — 
is the user becoming a better runner?).

---

## 8. Documentation Impact

Tick every doc that will be created or updated across the full feature 
build. This is the contract — if a ticked doc isn't updated by the end 
of the feature, the feature is not done.

- [ ] `/docs/features/{feature-name}.md` — feature spec
- [ ] `/docs/architecture/rules-engine.md` — rule additions / changes
- [ ] `/docs/architecture/data-model.md` — schema changes
- [ ] `/docs/ai-prompts/{feature-name}.md` — prompts + rationale
- [ ] `/docs/adr/ADR-{nnnn}-{slug}.md` — architectural decisions
- [ ] `/docs/brand/voice-examples.md` — new approved copy examples
- [ ] API / integration docs (if applicable)
- [ ] README / onboarding notes (if developer-facing changes)

---

## 9. Approval

**Senior dev recommendation (one sentence):**

**Status:** Draft / Awaiting approval / Approved / Rejected

**Approved by:** 
**Approval date:** 
**Phase 1 may begin on:** 

---

## Appendix A — Evidence

Screenshots, query outputs, benchmarks, example data, or anything 
that supports claims made above. Keep this section — future-you will 
want to know why a threshold was set at 20% and not 15%.
