# ADR-002 — Plan Data: JSON First, Never Direct-to-DB

**Status**: Accepted  
**Date**: 2026-04-15

---

## Context

Plan creation (R23) and plan reshaping (R20) both produce training plans. The question was whether to write plan output directly to a Supabase table or maintain an intermediate JSON representation. Direct-to-DB was simpler in the short term but risked locking the architecture to Supabase and creating a gap between plan validation and storage.

---

## Decision

Plan creation and reshaping always produce a validated JSON object as output. That JSON is saved wherever is appropriate for the current phase (GitHub Gist now, Supabase table later, S3 later still). No generator or reshaper writes directly to a database table.

Plan creation (R23) and reshaping (R20) are **separate concerns** with separate inputs, outputs, and UI — but they share the same JSON schema and coaching rules.

---

## Rationale

- **Validation checkpoint**: JSON-first allows schema validation before any write. A bad plan is caught before it touches persistent storage.
- **DB portability**: The app doesn't care where the JSON came from as long as it matches the schema. Switching from Gist to Supabase to S3 requires no changes to the generator or reshaper.
- **Debugging**: A JSON blob is inspectable. A row inserted directly from an AI generation step is opaque until you read it back out.
- **Separation of concerns**: Creation and reshaping are intentionally different flows. Sharing a schema without sharing a codebase keeps complexity contained.

---

## Consequences

- **Positive**: Storage layer is swappable without touching generator logic.
- **Positive**: Plans can be previewed, edited, or rejected before being saved.
- **Constraint**: Any generator or reshaper output must be validated against the schema before save. See `docs/canonical/plan-schema.md`.
- **Ongoing**: Current storage is GitHub Gist. Supabase plan table is a future migration — this decision makes that migration trivial.
