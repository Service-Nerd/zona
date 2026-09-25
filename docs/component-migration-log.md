# Component migration log — buttons and shared primitives

**A rolling document. Update it every time a batch migrates; do not rewrite history — append.**

This exists because `BUTTON-COMPONENT-01` shipped a `Button` component and converted **41 of 219**
controls. The other 178 are not a hidden risk, they are unfinished work, and the only way that stays
true is if the number is written down and moved.

**Owner:** 🧭 Design Board (the primitives) · **Gate:** `components/ui/buttonOwnership.test.ts`
**Pattern:** `ui-patterns.md` § 38 · **Contract:** `docs/contracts/components/button.md`

---

## The standing count

Re-measure before each batch. **Never quote this table from memory — regenerate it.**

```bash
# total controls, component vs hand-rolled, by area
python3 - <<'PY'
import re, pathlib, collections
files=[p for p in pathlib.Path('.').rglob('*.tsx')
       if not any(x in p.parts for x in ('node_modules','.next','ios')) and '.test.' not in p.name]
def tags(s,tag):
    out=[]
    for m in re.finditer(r'<'+tag+r'(?=[\s>])',s):
        i=m.end(); d=0
        while i<len(s):
            c=s[i]
            if c=='{': d+=1
            elif c=='}': d-=1
            elif c=='>' and d==0: break
            i+=1
        out.append(s[m.start():i+1])
    return out
def app(p):
    s=str(p); return '/dashboard' in s or '/auth' in s or 'components/shared' in s \
        or 'components/training' in s or 'components/strava' in s
c=collections.Counter()
for p in files:
    src=p.read_text(); a='app' if app(p) else 'website'
    c[(a,'component')] += len(tags(src,'Button'))
    c[(a,'raw')]       += len(tags(src,'button'))
for k,v in sorted(c.items()): print(k, v)
PY
```

| Date | Total | Using a shared component | Hand-rolled | Notes |
|---|---|---|---|---|
| 2026-09-25 | **219** | **41** (19%) | **178** | `BUTTON-COMPONENT-01` shipped. Converted the **moss** controls only, because those were the ones failing WCAG AA. Everything else was out of scope for a contrast fix |
| 2026-09-25 | **219** | **44** (20%) | **175** | `WEBSITE-BUTTON-UNIFY-01`. The 3 site CTAs adopted the `.btn` **classes** (not the component) and `.cta-pill` was deleted. **The site and the app now have one definition** |
| 2026-09-25 | **217** | **90** (41%) | **127** | Batches 2 + 3. `secondary` ×14, `ghost` ×31, plus 2 CTAs the gate had been blind to. **`--accent: var(--moss)` — a legacy alias — bypassed the gate entirely; it now resolves the alias graph from the stylesheet** |

---

## What the 178 actually are (measured 2026-09-25)

**This breakdown is the point.** "178 hand-rolled buttons" sounds like one job. It is not — it is
three different primitives and a residue, and **only about 100 of them belong in `Button` at all.**

| Count | What it is | Where it should end up |
|---|---|---|
| **53** | Text / link buttons — no fill, a label and a tap target | `Button variant="quiet"` |
| **43** | Neutral surface buttons — `--bg-soft` or `--card` fill with a border | `Button variant="secondary"` |
| **36** | **Selected-state toggles** — day pickers, RPE, zone chips, `CardSelect` | ⛔ **NOT `Button`.** A different primitive |
| **15** | Icon-only / bare tap targets | ⛔ **NOT `Button`.** Needs an `IconButton` |
| **4** | Other filled buttons | `Button` — variant on inspection |
| **3** | Unclassified | Inspect individually |
| **14** | The website (`.cta-pill` × 3, inline × 6, link-as-button × 2, bare × 3) | See the website section |

⚠️ **The 36 selected-state controls must not be swept into `Button`.** The moss active fill is the
only selected affordance (`ui-patterns.md` § CardSelect), and a fill is graphics at 3:1, not text at
4.5:1. `buttonOwnership.test.ts` keys on fill-**plus**-label specifically so it can never demand
their conversion. Migrating them is a *separate* decision about a *separate* primitive.

---

## The website — ✅ RESOLVED 2026-09-25 (`WEBSITE-BUTTON-UNIFY-01`)

**The site and the app now share one definition: `.btn` in `globals.css`.** `.cta-pill` is deleted.

⚠️ **The board rejected the obvious answer and the reason is worth keeping.** The proposal was
*"unify onto `Button` with an `as`/`ButtonLink`"*. No seat argued for it. **The shared unit is the
CLASS layer, not the component** — `Button.tsx` is 30 lines of prop-spreading; the design is in the
stylesheet. So the site writes `className="btn btn--primary btn--compact"` on its own `<a>`.

🔴 **And that framing mattered technically.** `SiteHeader.tsx` and `app/charity-runners/page.tsx`
are **server** components. Importing a `'use client'` component into them is `BUNDLE-BOUNDARY-01`
— 110 kB → 249 kB and 114 kB → 251 kB, both silently. `Button.tsx` now carries **no directive** (it
has no hook, no state, no browser API), so the trap is disarmed for whoever tries next.

**Measured:** hand-typed visual properties on site CTAs **26 → 0**; `/charity-runners` First Load JS
**96.8 kB → 96.8 kB**. ⚠️ Three *declared* variants remain (`compact+pill`, `compact`, `regular`) —
from one definition instead of three hand-typed ones. The success condition was phrased "3 → 1" and
**that literal number is not met**; recorded as measured.

⚠️ **Email remains a third surface that can never share code** — an HTML string builder, and Outlook
drops `box-shadow`. `ctaButton()` mirrors the contract by hand with a 1px `--moss-deep` border, and
the gate asserts its fill separately.

## Batch log — append, never rewrite

### 2026-09-25 · Batch 1 — `BUTTON-COMPONENT-01`
**Scope:** every control whose LABEL sat on moss, because all 42 failed WCAG AA.
**Converted:** 41 across 17 files (27 primary-shape, 14 moss-label) + the email CTA.
**Left deliberately:** 15 selected-state moss controls (graphics at 3:1, standing rule).
**Result:** 41 / 219 on the component. Gate green, suite 3,485 green, `audit-docs.sh` ALL CLEAN.
**Not verified:** nothing pressed on a device.

### 2026-09-25 · Batch 1b — `WEBSITE-BUTTON-UNIFY-01`
**Scope:** the 3 marketing CTAs + `.cta-pill`.
**Converted:** 3 to the `.btn` classes. `.cta-pill` deleted. `.btn--pill` added so the header's
`999` radius is declared rather than inherited. `'use client'` removed from `Button.tsx`.
**Also fixed, because the conversion caused it:** the waitlist input was 46px/14px beside a
48px/18px button. **The input moved to match the button**, not the reverse — the button carries the
system now.
**Result:** 44 / 219. Gate +3 arms, each falsified to red. Suite 3,488 green. Bundle unchanged.
**Not verified:** no device, no Lighthouse run after the change, nothing measured at 320px.

### 2026-09-25 · Batches 2 + 3 — `BUTTON-MIGRATION-02`
**Scope:** neutral-surface → `secondary` (14) and de-emphasised text → `ghost` (31).
**Result:** 90 / 217 on the shared system, up from 44.

🔴 **The gate I shipped this morning had a hole, found by doing the next batch.** `--accent` is a
System B legacy alias for `--moss`, and **two live primary CTAs painted themselves `var(--accent)`
with white text** — the identical 3.68:1 failure — matching neither arm, because the check compared
the token NAME while the producer used a different name for the same colour. The fix is not a second
hardcoded list: **the alias graph is now read from `globals.css`**, so a legacy alias added tomorrow
is covered without anyone remembering.

🔴 **A new variant was required by a standing ruling, not chosen.** `:456` says *dismiss is never
`--moss`*. 44 de-emphasised text buttons are `--mute`; converting them to `quiet` (moss) would have
turned 44 grey controls green and reversed that ruling **while looking like a migration**. Hence
`ghost`.

📐 **Four text buttons were failing AA and nobody had asked:** three `--warn` labels at **2.69:1**
(fixed to `--warn-strong`, 4.53:1) and one `--danger` at **4.36:1** on the `--bg-soft` row it sits
in. The last has **no `--danger-strong` to move to**, so it is filed as `DANGER-TEXT-CONTRAST-01`
(palette addition = Design Board) and baselined with its reason.

**Declined, correctly:** 3 circular (`borderRadius: 50%`) and 8 fixed-`44px` controls → the
`IconButton` batch. 1 `--strava` brand fill and 1 `--ink` fill → neither is `secondary`.
**Not verified:** no device.

### Next batches — proposed, not ruled

| # | Scope | Size | Blocked on |
|---|---|---|---|
| ~~2~~ | ~~Neutral surface~~ | — | ✅ **DONE.** 14 converted; the rest were icons, brand fills or conditionals |
| ~~3~~ | ~~Text/link~~ | — | ✅ **DONE** as `ghost`, not `quiet`. ⚠️ **The warning in this row paid off: 4 of them were failing AA** |
| 4 | `IconButton` primitive, then migrate | ~15 | 🧭 **Design Board** — a new primitive |
| ~~5~~ | ~~Website~~ | — | ✅ **DONE 2026-09-25.** Board ruled the classes, not the component |
| — | Selected-state toggles | ~36 | ⛔ **Out of scope by rule.** Separate primitive, separate ruling |

✅ **Batch 3's recorded warning paid for itself.** It said: *"those text buttons are not moss, so the
gate says nothing about them — measure their contrast before converting, or the batch will look like
a migration and quietly be an audit."* Measured: **4 of 51 were failing AA.** Writing the assumption
down is what made it get checked.

⚠️ **The remaining 127 are now mostly NOT Button's job** — icon-only controls, selected-state
toggles, and one-off surfaces. The next real primitive is `IconButton` (🧭 Design Board).
