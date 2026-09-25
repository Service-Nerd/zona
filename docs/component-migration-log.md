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

## The website — the biggest visible gap

**The site does not use `Button` at all.** It has its own `.cta-pill` class in `globals.css`
(hover, `:focus-visible`, `:active`), used by 3 files, plus 6 inline-styled buttons and 2
links-as-buttons.

`.cta-pill` is not wrong — it was its own reviewed answer (SLT 2026-09-21, the site had no hover
state at all). But it means **a button change now has to be made twice**, which is the exact defect
`BUTTON-COMPONENT-01` was built to end, surviving at the seam between the two surfaces.

⚠️ **Not a straight swap.** `.cta-pill` is applied to `<a>` and `<Link>`, not `<button>`, because the
site's CTAs navigate. Unifying needs `Button` to render as an anchor (an `as` prop or a sibling
`ButtonLink`), which is a real design decision, not a find-and-replace.

⚠️ **And email is a third surface that can never import the component** — it is an HTML string
builder, and Outlook drops `box-shadow`. `ctaButton()` in `lib/email/trialEmailTemplates.ts` mirrors
the contract by hand with a 1px `--moss-deep` border. **Three surfaces, and only two of them can
ever share code.** The email one is kept honest by the gate asserting its fill separately.

---

## Batch log — append, never rewrite

### 2026-09-25 · Batch 1 — `BUTTON-COMPONENT-01`
**Scope:** every control whose LABEL sat on moss, because all 42 failed WCAG AA.
**Converted:** 41 across 17 files (27 primary-shape, 14 moss-label) + the email CTA.
**Left deliberately:** 15 selected-state moss controls (graphics at 3:1, standing rule).
**Result:** 41 / 219 on the component. Gate green, suite 3,485 green, `audit-docs.sh` ALL CLEAN.
**Not verified:** nothing pressed on a device.

### Next batches — proposed, not ruled

| # | Scope | Size | Blocked on |
|---|---|---|---|
| 2 | Neutral surface → `variant="secondary"` | ~43 | nothing. The variant exists |
| 3 | Text/link → `variant="quiet"` | ~53 | nothing. ⚠️ Check each one's colour first: these are NOT moss (the gate is green), so contrast is unproven, not known-good |
| 4 | `IconButton` primitive, then migrate | ~15 | 🧭 **Design Board** — a new primitive |
| 5 | Website: `Button` as an anchor, retire `.cta-pill` | ~14 | 🧭 **Design Board** — `as` prop vs `ButtonLink` is a real decision |
| — | Selected-state toggles | ~36 | ⛔ **Out of scope by rule.** Separate primitive, separate ruling |

⚠️ **Batch 3 carries an unmeasured assumption and it is written here so it is not forgotten:** those
53 text buttons are not moss, so `buttonOwnership.test.ts` says nothing about them. **Measure their
contrast before converting**, or the batch will look like a migration and quietly be an audit.
