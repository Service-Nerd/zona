// emailTheme.ts — the Warm Slate palette, for surfaces that cannot use CSS variables.
//
// 🔴 DESIGN BOARD ARTIFACT 2, 2026-09-24. The email templates carried five hex
// literals. They were the CORRECT values, which is why Silvanto explicitly
// declined to veto — a hardcoded-but-right value is a maintenance defect, not a
// regression against a documented rule. But they were legal only because the
// pre-commit hex hook scopes to `app/` and `components/` while the templates
// live in `lib/`, so the token layer and this surface had never met.
//
// ⚠️ WHY LITERALS ARE UNAVOIDABLE HERE, unlike anywhere else in the product.
// An email is rendered by Gmail, Outlook and Apple Mail, none of which resolve
// `var(--bg)`: CSS custom properties are stripped or ignored by most clients, so
// every colour must be inlined as a value. The same is true of the unsubscribe
// page, which opens in whatever browser a mail client hands it — often an in-app
// webview with no access to the site's stylesheet.
//
// So the rule is not "no literals", it is **one place**. These MUST stay equal to
// the tokens in `app/globals.css`; `emailTheme.test.ts` asserts it by reading
// both, so the two cannot drift the way `--surface-moss-wash` did.

/** Warm Slate (ADR-007). Values mirror `app/globals.css` and are asserted equal. */
export const EMAIL_COLORS = {
  /** `--bg` — the warm off-white ground */
  bg: '#F3F0EB',
  /** `--card` — the white card the message sits on */
  card: '#FFFFFF',
  /** `--ink` — primary text, and the runner's own numbers */
  ink: '#1A1A1A',
  /** `--ink-2` — secondary text, the consequence rather than the fact */
  ink2: '#3D3A36',
  /** `--mute` — the footer, and nothing else.
   *
   *  🔴 THIS WAS `#8A857D` UNTIL THIS TEST RAN. `globals.css` says `#6D6963`;
   *  `CLAUDE.md`'s design-system table says `#8A857D`. **The doc and the token
   *  disagree, and the email templates had copied the doc**, so every footer
   *  Zonna has ever sent rendered in a grey the app does not use. The token layer
   *  is the authority (ADR-007). The stale table in `CLAUDE.md` is reported, not
   *  edited here. */
  mute: '#6D6963',
  /** `--moss` — the eyebrow, and ONLY the eyebrow. See `mossStrong`. */
  moss: '#6B8E6B',
  /** `--moss-strong` — the CTA FILL (BUTTON-COMPONENT-01, 2026-09-25).
   *
   *  🔴 The CTA filled with `moss` and labelled `card` for the whole life of the
   *  email programme: white on #6B8E6B is **3.68:1** and WCAG AA wants 4.5:1 at
   *  this size. `A11Y-CONTRAST-01` had already measured that exact failure on
   *  the marketing button and shipped `--moss-strong` for it — and `lib/email`
   *  had **zero** uses of it, the same remedy-applied-to-one-twin shape as the
   *  66 app buttons this landed with.
   *
   *  ⚠️ Email cannot carry the app's elevation: Outlook drops `box-shadow`, so
   *  the ruling gives the email CTA a 1px `mossDeep` border instead. Same
   *  button by a different device, deliberately. */
  mossStrong: '#557055',
  /** `--moss-deep` — the CTA's border, and its hover in clients that support one. */
  mossDeep: '#465D46',
} as const

export type EmailColor = keyof typeof EMAIL_COLORS

/**
 * The type scale, mirrored from `globals.css` exactly as the colours are.
 *
 * 🔴 DESIGN BOARD, 2026-09-24: **"flat" had a measurable cause.** The emails used
 * six sizes, only four of them on the documented scale, and **12 of 20
 * declarations were the same 16px** — so eyebrow, fact and consequence all read
 * identically and the reader felt it as indifference.
 *
 * That is the website defect again: Silvanto caught **170 hand-typed sizes with
 * an H1:H2 step of 1.02×**. The rule and the token had never met, and here the
 * surface had never adopted the scale at all.
 *
 * ⚠️ Silvanto corrected his own earlier ruling in the same sitting: *"'no
 * decoration' was about email 1 having no data to dramatise. It was never a
 * ruling that the emails should have no visual system. **Restraint is a hierarchy
 * decision, not an absence of one.**"*
 *
 * Only the steps an email actually needs. `emailTheme.test.ts` asserts each is
 * equal to its `--fs-*` token.
 */
export const EMAIL_TYPE = {
  /** `--fs-micro` — the footer, and nothing else */
  micro: 10,
  /** `--fs-eyebrow` — tracked uppercase label above a fact */
  eyebrow: 11,
  /** `--fs-caption` — dates, meta */
  caption: 12,
  /** `--fs-body` — the consequence, the quieter half */
  body: 14,
  /** `--fs-lead` — the sentence that carries the message */
  lead: 16,
  /** `--fs-h4` — a heading that is words rather than a number */
  heading: 21,
  /** `--fs-metric` — a number that IS the heading */
  metric: 26,
  /** `--fs-metric-lg` — the one hero figure in the programme (first read) */
  metricLg: 38,
  /** The wordmark's brand-moment size (`Wordmark` size `md`). */
  wordmark: 32,
} as const

/**
 * The wordmark, as inline HTML.
 *
 * 🔴 SILVANTO EXERCISED HIS VETO ON THIS, AND NAMED THE RULE — the wordmark
 * specification in `components/ui/Wordmark.tsx`, regressed on **five counts**:
 * weight (800 → 600), tracking (−0.03em → **+0.06em**), case (as written →
 * UPPERCASE), colour (ink with the **nn in moss** → all moss) and size (32 → 13).
 *
 * *"That NN-moss device is the only distinctive mark this brand owns, and the
 * email replaced it with a generic tracked-uppercase label indistinguishable
 * from any SaaS footer."*
 *
 * ⚠️ TEXT, NEVER AN IMAGE (Wroblewski). Mail clients block images by default, so
 * a logo image renders as a broken box on first open for most readers. Inter 800
 * with a coloured span is text and always renders.
 *
 * ⚠️ The double letter is DERIVED from `BRAND.name`, exactly as the component
 * does it — so a rename carries the device with it instead of stranding a
 * hardcoded "nn".
 */
export function emailWordmark(name: string, px: number = EMAIL_TYPE.wordmark): string {
  const lower = name.toLowerCase()
  let split: [string, string, string] | null = null
  for (let i = 0; i < lower.length - 1; i++) {
    if (lower[i] === lower[i + 1]) {
      split = [name.slice(0, i), name.slice(i, i + 2), name.slice(i + 2)]
      break
    }
  }
  const base = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;`
    + `font-weight:800;font-size:${px}px;letter-spacing:-0.03em;line-height:1;color:${EMAIL_COLORS.ink};`
  if (!split) return `<span style="${base}">${name}</span>`
  const [pre, accent, post] = split
  return `<span style="${base}">${pre}<span style="color:${EMAIL_COLORS.moss};">${accent}</span>${post}</span>`
}
