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
  /** `--moss` — the eyebrow and the single CTA */
  moss: '#6B8E6B',
} as const

export type EmailColor = keyof typeof EMAIL_COLORS
