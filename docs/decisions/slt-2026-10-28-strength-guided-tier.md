# SLT: tier for the guided strength session and timers (2026-10-28, STRENGTH-GUIDED-SESSION-01)

**Brief:** start / end a session, one part per page, rest and exercise timers, quicker weight entry.
**Tier: PAID, inherited.** The strength engine is wholly PAID (SLT 2026-10-16, `featureGates.ts → strength_sessions_tailored`)
and admin-only until release (`lib/strength-bridge/release.ts`). Doing the session you were given is access to that
feature, not new richness on top of it, so no separate gate: every runner who has strength gets the guided session.

**Fried:** do not create a second paywall inside a paid feature. **Wood:** a guided flow removes the decision "what next"
at the moment willpower is lowest; that is context, not motivation, and the right kind of feature. **Sutherland:** the
timer is the feature people will mention. **Zhuo:** design ruled (`STRENGTH-GUIDED-SESSION-01`). **Hutchinson:** coaching
ruled the shape (2026-10-28). **Recommendation: build, PAID (inherited), in the order of the build plan.**
