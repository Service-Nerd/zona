import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'
import { splitTopLevelArgs } from '../ops/splitTopLevelArgs'

// COMPONENT-CONTRACT-GATE-01 — `docs/contracts/components/` is checked by
// something now.
//
// WHY. CLAUDE.md: "When changing any API route or component prop interface:
// update `docs/contracts/` in the same commit." Only the API half was ever
// mechanical — `scripts/audit-docs.sh` walks `app/api/**/route.ts` and compares
// against `docs/contracts/api/`. Nothing has ever looked at the components
// directory.
//
// ⚠️ WHAT THAT COST, measured 2026-09-18 by reading the four files by hand:
//   - `plan-calendar.md` documented 5 props; the component takes 9. The four
//     missing ones include `units`, i.e. the entire INV-PREF-001 surface.
//   - `session-card.md` documented SEVEN props — `session`, `preferredUnits`,
//     `preferredMetric`, `zone2Ceiling`, `restingHR`, `maxHR`, `aerobicPace` —
//     and **not one of them exists**. The real component takes `type`, `role`,
//     `name`, `detail`, `distanceKm`… That contract described a component that
//     was never built, or was rewritten around it, and nothing noticed.
//
// A contract nobody checks is worse than no contract: it is documentation that
// reads as authoritative and is fiction.
//
// ⚠️ THE CONTRACT DECLARES ITS OWN SUBJECT, and that is deliberate. The obvious
// implementation is a `{contract: component}` map inside this test — but then
// the checker holds the same hand-written list as the thing it checks, which is
// the flaw this repo has already paid for in `supersedeCoverage.test.ts` and
// `deloadCadence.test.ts`. A contract with no `**Component:**` line FAILS here,
// so a new contract cannot be added without declaring what it governs.

const DIR = join(process.cwd(), 'docs/contracts/components')

/** Prop names the COMPONENT actually takes. */
function componentProps(raw: string): string[] | null {
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  // 🔴 THE DEFAULT EXPORT IS THE SUBJECT, AND THIS READ WHICHEVER CAME FIRST.
  // Found 2026-10-01 registering `sheet.md`: `Sheet.tsx` exports
  // `NavHeightProvider({ value, children })` at line 64 and `export default
  // function Sheet(...)` at line 97, so the gate compared the contract for
  // `Sheet` against **`NavHeightProvider`'s props** and reported `value` as an
  // undocumented prop of Sheet. **A gate that reads the wrong component does
  // not decline to check — it checks confidently and wrongly**, which is the
  // worse half of this file's own "only as wide as its list" lesson.
  //
  // Order, most specific first: `interface Props`, then the props interface
  // NAMED AFTER the default export (`SheetProps`), then the default export's
  // own destructure, then the first named export.
  const defaultName = src.match(/export default function (\w+)/)?.[1] ?? null
  // 🔴 THE INTERFACE BODY IS FOUND BY BALANCING BRACES, NOT BY A LAZY REGEX.
  // This was `interface <name> \{([\s\S]*?)\n\}`, which is two defects at once:
  //   · it REQUIRES `\n}` to close, so a ONE-LINE `interface Props { a: string; b: number }`
  //     read as `null` — "could not read props" for a shape that is perfectly readable;
  //   · and the `extends` resolution added for the union path used `\n?\}`, which is LAZY, so
  //     it stopped at the first NESTED `}` instead of the interface's own. That one happened to
  //     still produce the right names, because the depth-aware member split kept the truncated
  //     fragment together — **it was correct by luck, which is not a property to keep.**
  // Balancing is deterministic for both, and `null` when there is no body stays `null`.
  /** @param allowExtends follow an `extends` clause. See the two callers' comments — the
   *  top-level `Props` lookup must NOT, the union-member lookup must. */
  const ifaceBody = (name: string, allowExtends: boolean): string | null => {
    const head = src.match(new RegExp('interface ' + name + (allowExtends ? '\\s*(?:extends ([^{]+?))?\\s*' : '\\s*') + '\\{'))
    if (!head || head.index === undefined) return null
    let i = head.index + head[0].length
    let depth = 1
    const from = i
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
    }
    return depth === 0 ? src.slice(from, i - 1) : null
  }
  /** The `extends` clause of an interface, or []. */
  const ifaceParents = (name: string): string[] => {
    const head = src.match(new RegExp('interface ' + name + '\\s*(?:extends ([^{]+?))?\\s*\\{'))
    return (head?.[1] ?? '').split(',').map(t => t.trim()).filter(Boolean)
  }
  // ⚠️ MEMBERS ARE SPLIT ON A TOP-LEVEL `;` AS WELL AS A NEWLINE, because a one-line
  // interface is one line: `interface TrendCardLabels { label?: string; sessionLabel?: string }`
  // yielded only `label`, and three of TrendCard's five union members are written that way —
  // so the union resolution below would have dropped `sessionLabel` and `onUpgrade` silently
  // and then reported them as props the CONTRACT invented.
  //
  // 🔴 A PLAIN `;` SPLIT IS WRONG, MEASURED: it descends into a nested inline object type, so
  // `StrengthGuidedSessionProps`'s `session: { … ended_at?: string }` contributed `today`,
  // `units`, `onLog` and `ended_at` as top-level props and turned two EXISTING contracts red
  // within one run. **The depth tracking is the fix; the semicolon alone is a regression.**
  // 🔴 `<` AND `>` ARE NOT TRACKED, AND THE REASON IS A MEASURED, ORDER-DEPENDENT FAILURE.
  // Counting them looks right for `Record<string, X>` and is wrong for `=> `: the arrow's `>`
  // decrements with no matching `<`, so after one `onSetStatus: (…) => Promise<boolean>` the
  // depth sat at -1 for the rest of the interface and a LATER nested `;` split at "depth 0".
  // That is how `StrengthSessionScreenProps` leaked `today`, `units`, `onLog` out of its
  // `lifts?: { … }`. ⚠️ **My own probe of this splitter passed, because it listed the two
  // members in the other order** — the defect needs the arrow to come FIRST. Depth is also
  // clamped at 0, so no other unbalanced closer can reopen the same hole. A generic carries
  // no `;` or newline, so ignoring it costs nothing.
  const splitMembers = (body: string): string[] => {
    const out: string[] = []
    let depth = 0
    let cur = ''
    for (const ch of body) {
      if (ch === '{' || ch === '(' || ch === '[') depth++
      else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
      if ((ch === '\n' || ch === ';') && depth === 0) { out.push(cur); cur = '' } else cur += ch
    }
    out.push(cur)
    return out
  }
  const readIface = (body: string): string[] =>
    splitMembers(body).map(l => l.trim()).filter(Boolean)
      .map(l => (l.match(/^([A-Za-z_$][\w$]*)\s*\??\s*:/) || [])[1]).filter(Boolean) as string[]

  // ⚠️ `allowExtends: false` HERE, AND IT IS LOAD-BEARING (measured 2026-11-15).
  // The regex this replaced required exactly one space before `{`, so `interface ButtonProps
  // extends React.ButtonHTMLAttributes<HTMLButtonElement>` did not match and the parser fell
  // through to the DESTRUCTURE — which is the right answer for a component that spreads HTML
  // attributes, because its real prop set is unbounded and the destructure is what it names.
  // Allowing `extends` here read `button.md` and `icon-button.md` as claiming three and one
  // FICTIONAL props respectively. The accident was correct; it is now a decision.
  const namedBody = ifaceBody('Props', false)
    ?? (defaultName ? ifaceBody(`${defaultName}Props`, false) : null)
  if (namedBody != null) return readIface(namedBody)

  // ⚠️ A UNION PROP TYPE — THE FOURTH SHAPE, AND THIS FUNCTION'S OWN COMMENT PREDICTED IT
  // (`CONTRACT-COVERAGE-03`, 2026-11-15: *"a parser widened by hand three times is a parser
  // with a fourth shape in it"*). `TrendCard(props: TrendCardProps)` is a NON-destructured
  // default export over `type TrendCardProps = A | B | C | D | E`, so every matcher above and
  // below missed it and this returned `null` — the contract could not be written at all
  // without turning the gate red, which is how a component stays uncontracted for a reason
  // that has nothing to do with the component.
  //
  // 📐 Measured: `components/` holds exactly ONE union prop type and it is this one. Two other
  // uncontracted components are non-destructured over a plain `interface`, which the matcher
  // above already reads. A real shape with one instance, not a class.
  //
  // What a union "takes" is the UNION OF ITS MEMBERS' props — that is what a caller may legally
  // pass — so members are resolved and `extends` parents followed transitively. Which props are
  // REQUIRED per `state` is the contract's prose to state; this gate is prop-name parity.
  const unionMembers = (alias: string): string[] | null => {
    const m = src.match(new RegExp('type ' + alias + '\\s*=([^;]*?)\\n\\n'))
    if (!m) return null
    const members = m[1].split('|').map(t => t.trim()).filter(t => /^[A-Za-z_$][\w$]*$/.test(t))
    return members.length > 1 ? members : null
  }
  /** An interface's own props plus every `extends` parent's, transitively. */
  const ifaceWithParents = (name: string, seen: Set<string>): string[] => {
    if (seen.has(name)) return []
    seen.add(name)
    // `allowExtends: true` — following parents is the whole point on this path.
    const body = ifaceBody(name, true)
    if (body == null) return []
    return [...ifaceParents(name).flatMap(pn => ifaceWithParents(pn, seen)), ...readIface(body)]
  }
  for (const alias of [defaultName ? defaultName + 'Props' : null, 'Props'].filter(Boolean) as string[]) {
    const members = unionMembers(alias)
    if (!members) continue
    const props = Array.from(new Set(members.flatMap(mn => ifaceWithParents(mn, new Set<string>()))))
    // An alias resolving to NOTHING is unreadable, not propless — the empty-vs-unparseable
    // distinction this function already records for `SiteFooter`.
    if (props.length) return props
  }

  // The DEFAULT export's destructure, before any named one.
  if (defaultName) {
    // ⚠️ `(?:<[^>]*>)?` HERE TOO, AND IT WAS MISSING (/code-review, 2026-11-10). The generic
    // allowance was added to the NAMED-export matcher below in the same commit, and the
    // `return null` three lines down short-circuits before it — so a GENERIC DEFAULT export
    // returned `null` where it would have parsed correctly, and the allowance was unreachable
    // for half the shapes it claimed to cover. **A guard added on one branch is not added.**
    const d = src.match(new RegExp('export default function ' + defaultName + '\\s*(?:<[^>]*>)?\\s*\\(\\s*\\{([\\s\\S]*?)\\}\\s*:'))
    if (d) return splitTopLevel(d[1])
    // 🔴 A DEFAULT EXPORT WE COULD NOT READ MUST NOT FALL THROUGH TO A SIBLING, AND IT DID
    // (2026-11-10, writing `zone-rings.md` for `CONTRACT-COVERAGE-03`).
    //
    // This is the `sheet.md` / `NavHeightProvider` defect above in a NEW SHAPE. That fix made
    // the default export the subject when it is DESTRUCTURED; a default export whose parameter
    // is a plain `props: Props` still dropped to the generic matcher below and read whichever
    // named function came first. `ZoneRings(props: Props)` is a four-way discriminated union, so
    // the gate compared its contract against **`ZoneRingsSkeleton`'s** `{ label, chromeless }`
    // and would have reported every real prop as fictional.
    //
    // ⚠️ The lesson is the one this function already records: **a gate that reads the wrong
    // component does not decline to check, it checks confidently and wrongly.** So when there IS
    // a default export, the answer is its props or `null` — never a sibling's. `null` makes the
    // caller's `expect(actual).not.toBeNull()` fire, which is loud and correct.
    //
    // 📐 Measured before changing it: of **74** single-component contracts the verdict moves on
    // exactly **one**, `zone-rings.md`, from `["label","chromeless"]` to `null`. No collateral.
    // (An empty parameter list is still `[]` — "takes nothing" stays decidable, per the
    // `SiteFooter` note below.)
    if (new RegExp('export default function ' + defaultName + '\\s*(?:<[^>]*>)?\\s*\\(\\s*\\)').test(src)) return []
    return null
  }
  // ⚠️ NAMED EXPORTS TOO, and the reason is a real miss. This matched only
  // `export default function`, and every marketing component in this codebase
  // is a NAMED export — so registering a contract for one produced "could not
  // read props" rather than a comparison. A parser that only understands one
  // export style silently declines to check the other, which is the same
  // "only as wide as its list" shape as the three audit checks widened
  // earlier today. Found 2026-09-21 by registering contracts for HrTrace,
  // Section, TabbedPhone and PhoneShell.
  // ⚠️ `(?:<[^>]*>)?` — A GENERIC COMPONENT, AND THERE IS EXACTLY ONE IN THE TREE.
  // `export function SegmentedControl<T extends string>({ … })` did not match, because the
  // pattern allowed only whitespace between the name and the paren, so writing its contract
  // produced "could not read props" rather than a comparison. **Third instance of this
  // function's own "only as wide as its list" lesson** — after default-vs-named and
  // empty-vs-unparseable. 📐 Measured: `components/` holds **1** generic export, it is
  // `SegmentedControl`, and the hole was unreachable until that contract existed, which is the
  // argument for writing them: a contract IS a code review.
  const m = src.match(/export (?:default )?function \w+\s*(?:<[^>]*>)?\s*\(\s*\{([\s\S]*?)\}\s*:/)
  if (m) return splitTopLevel(m[1])

  // 🔴 "TAKES NOTHING" IS AN ANSWER, AND IT USED TO BE INDISTINGUISHABLE FROM
  // "COULD NOT PARSE" — so a propless shared component could not be contracted
  // at all: the caller asserts `not.toBeNull()`, so writing its contract turned
  // this gate RED. `SiteFooter` is exactly that — a named export with an empty
  // parameter list, 11 importers, every page of the marketing site — and its
  // contract is a real one ("takes nothing; the link set is identical on every
  // page, self-link included").
  //
  // ⚠️ The two states are genuinely decidable and must stay separate: an EMPTY
  // parameter list is `[]`, an UNPARSEABLE one is still `null`. Collapsing them
  // would make every parser failure read as "no props" and silently stop
  // comparing, which is the failure this file already records twice.
  // Found 2026-10-02 writing SiteFooter's contract (CONTRACT-COVERAGE-02).
  if (new RegExp('export (?:default )?function \\w+\\s*(?:<[^>]*>)?\\s*\\(\\s*\\)').test(src)) return []
  return null
}

/** Destructured names, split on TOP-LEVEL commas only.
 *
 * ⚠️ THE SPLITTING IS `splitTopLevelArgs`'s JOB NOW (2026-11-10). This held its own loop, and
 * its quote-state fix landed here the same day a FOURTH copy of the same hole was found in
 * `check-clock-drift.ts` by `/code-review`. Two callers splitting an argument list identically
 * is a missing owner; the NAME extraction stays local because that part differs per caller. */
const splitTopLevel = (inner: string): string[] =>
  splitTopLevelArgs(inner)
    .map((p: string) => (p.trim().match(/^([A-Za-z_$][\w$]*)/) || [])[1])
    .filter(Boolean) as string[]

/** Prop names the CONTRACT documents, from its first fenced interface block. */
function contractProps(md: string): string[] | null {
  // Accept both shapes a real component uses: `interface Props {` and
  // `type Props = {`. Matching only one of them makes the gate depend on a
  // stylistic choice in the file it is checking.
  // ⚠️ `(?:<[^>]*>)?` here too, so a contract for a GENERIC component can state the real
  //    signature (`interface SegmentedControlProps<T extends string> {`) instead of quietly
  //    dropping the type parameter to satisfy the parser. Same allowance as `componentProps`.
  const block = md.match(/```(?:typescript|ts)\s*\n[\s\S]*?(?:interface \w+\s*(?:<[^>]*>)?\s*\{|type \w+\s*(?:<[^>]*>)?\s*= \{)([\s\S]*?)\n\}\s*\n```/)
  if (!block) return null
  return block[1].split('\n').map(l => l.trim()).filter(Boolean)
    .filter(l => !l.startsWith('//'))
    .map(l => (l.match(/^([A-Za-z_$][\w$]*)\s*\??\s*:/) || [])[1]).filter(Boolean) as string[]
}

const contracts = readdirSync(DIR).filter(f => f.endsWith('.md'))

describe('COMPONENT-CONTRACT-GATE-01 — component contracts match their components', () => {
  it('there are contracts to check (an empty scan is not a pass)', () => {
    expect(contracts.length).toBeGreaterThan(0)
  })

  for (const file of contracts) {
    describe(file, () => {
      const md = readFileSync(join(DIR, file), 'utf8')
      // ⚠️ `**Component:**` OR `**Components:**` WITH A LIST, and the second
      // shape is not a convenience. `marketing-device.md` governs PhoneShell,
      // PhoneFrame and TabbedPhone, which are one object: the device. Forcing
      // it to name a single file would have made it name PhoneShell and stay
      // silent about the other two, or split into three contracts that each
      // restate the same two rules — the duplication contracts exist to stop.
      // A gate that only understands one shape quietly declines to check the
      // other, which is this file's own recorded failure with named exports
      // and the same "only as wide as its list" shape as the audit checks.
      const single = md.match(/^\*\*Component:\*\*\s*`([^`]+)`/m)?.[1]
      const listed = single
        ? [single]
        : (md.match(/^\*\*Components:\*\*\n((?:- .*\n)+)/m)?.[1] ?? '')
            .split('\n')
            .map(l => (l.match(/`([^`]+\.tsx?)`/) || [])[1])
            .filter(Boolean) as string[]
      const declared = single ?? (listed.length ? listed[0] : undefined)

      it('🔴 declares the component it governs', () => {
        // Without this the test needs its own map, and a checker holding the
        // producer's list is blind to that list.
        expect(
          listed.length,
          `${file} needs a line: **Component:** \`path/to/Component.tsx\` (or ` +
            '`**Component:** none` with the reason), or a `**Components:**` bullet list.',
        ).toBeGreaterThan(0)
      })

      if (!declared || declared === 'none') return

      it('every declared component exists', () => {
        for (const d of listed) {
          expect(existsSync(join(process.cwd(), d)), `${d} not found`).toBe(true)
        }
      })

      // A multi-component contract documents the device's shape in prose and
      // several prop blocks; pinning it to ONE component's props would be a
      // false comparison. The prop-for-prop check is for single-component
      // contracts, which is all of the others.
      if (listed.length > 1) return

      it('🔴 documents exactly the props the component takes', () => {
        const actual = componentProps(readFileSync(join(process.cwd(), declared), 'utf8'))
        const documented = contractProps(md)
        expect(actual, `could not read props from ${declared}`).not.toBeNull()
        expect(documented, `${file} has no fenced `+'`interface X {`'+` or `+'`type X = {`'+` prop block`).not.toBeNull()

        const undocumented = actual!.filter(p => !documented!.includes(p))
        const fictional = documented!.filter(p => !actual!.includes(p))
        expect(
          { undocumented, fictional },
          `${file} vs ${declared}: 'undocumented' are real props the contract omits; ` +
            "'fictional' are props the contract claims that do not exist.",
        ).toEqual({ undocumented: [], fictional: [] })
      })
    })
  }
})

/**
 * 🔴 THE PARSERS, BOTH DIRECTIONS — because the gate above is CORPUS-ONLY and the corpus is
 * clean (2026-11-10, `CONTRACT-COVERAGE-03`).
 *
 * Every arm above reads `docs/contracts/components/` and compares it against the tree. When
 * both agree, a run cannot distinguish a working `componentProps` from one that returns `null`
 * for everything, and `componentProps` has now been widened **three times, each time by someone
 * finding a case by hand**: default-vs-named (`sheet.md`), empty-vs-unparseable (`SiteFooter`),
 * and a generic export (`SegmentedControl`). ⚠️ **A parser widened by hand three times is a
 * parser with a fourth shape in it**, and none of those widenings had a unit arm.
 *
 * These are the five shapes the function CLAIMS to handle, asserted directly, so the next
 * widening starts from a table rather than from an incident.
 */
describe('COMPONENT-CONTRACT-GATE-01 — the prop parsers, both directions', () => {
  it('reads `interface Props` and `<Name>Props` ahead of any destructure', () => {
    expect(componentProps(
      'interface Props {\n  a: string\n  b?: number\n}\nexport default function X({ ignored }: Props) {}',
    )).toEqual(['a', 'b'])
    expect(componentProps(
      'interface XProps {\n  a: string\n}\nexport default function X({ ignored }: XProps) {}',
    ), 'the interface named after the default export').toEqual(['a'])
  })

  it('reads the DEFAULT export\'s destructure, never a sibling\'s', () => {
    expect(componentProps(
      'export function Helper({ wrong }: { wrong: string }) {}\n' +
      'export default function X({ right, alsoRight }: { right: string; alsoRight?: number }) {}',
    ), 'the default export wins even when a named one comes first').toEqual(['right', 'alsoRight'])
  })

  it('🔴 a default export it CANNOT read returns null, never a sibling\'s props', () => {
    // This is the defect `zone-rings.md` found: `ZoneRings(props: Props)` is not destructured,
    // and the generic matcher below used to pick up `ZoneRingsSkeleton({ label, chromeless })`.
    // `null` is loud; a sibling's props are confidently wrong.
    expect(componentProps(
      'type Props = A | B\n' +
      'export function XSkeleton({ label, chromeless }: { label?: string; chromeless?: boolean }) {}\n' +
      'export default function X(props: Props) {}',
    )).toBeNull()
    // …and a propless default export is still DECIDABLE, not null.
    expect(componentProps('export default function X() {}')).toEqual([])
  })

  it('reads a NAMED export, including a GENERIC one', () => {
    expect(componentProps(
      'export function X({ a, b }: { a: string; b?: number }) {}',
    )).toEqual(['a', 'b'])
    expect(componentProps(
      'export function X<T extends string>({ options, value }: { options: T[]; value: T }) {}',
    ), 'SegmentedControl is the one generic component in the tree').toEqual(['options', 'value'])
    expect(componentProps('export function X<T>() {}'), 'generic and propless').toEqual([])
  })

  it('— and a GENERIC DEFAULT export, which the first cut could not read', () => {
    // /code-review, 2026-11-10: the generic allowance went on the NAMED matcher only, and the
    // `return null` for an unreadable default export fired first — so these two cases returned
    // `null`. The table covered a generic NAMED export and nothing else, which is why it passed.
    expect(componentProps(
      'export default function X<T extends string>({ a, b }: { a: T; b?: number }) {}',
    )).toEqual(['a', 'b'])
    expect(componentProps('export default function X<T>() {}'),
      'generic, default, propless').toEqual([])
  })

  it('returns null when there is nothing it can read', () => {
    expect(componentProps('const X = () => null\nexport default X')).toBeNull()
  })

  it('splits a destructure on TOP-LEVEL commas only', () => {
    expect(componentProps(
      "export default function X({ a, b = 'x,y', c }: { a: 1; b?: string; c: 2 }) {}",
    ), 'a comma inside a default value is not a separator').toEqual(['a', 'b', 'c'])
  })

  /**
   * 🔴 THE FOURTH SHAPE — A UNION PROP TYPE (`CONTRACT-COVERAGE-03`, 2026-11-15).
   *
   * `TrendCard(props: TrendCardProps)` is a non-destructured default export over
   * `type TrendCardProps = A | B | C | D | E`, so every matcher missed it and `componentProps`
   * returned `null` — the contract could not be written without turning the corpus arm red.
   * ⚠️ These arms exist because the previous three widenings had none, which is this file's own
   * recorded reason the parser kept being widened by hand.
   */
  it('resolves a UNION prop type to the union of its members, following `extends`', () => {
    const src = [
      'interface Labels { label?: string }',
      'interface Live extends Labels { state: \'live\'; hr: number }',
      'interface Locked extends Labels { state: \'locked\'; onUpgrade?: () => void }',
      '',
      'export type XProps =',
      '  | Live',
      '  | Locked',
      '',
      'export default function X(props: XProps) {}',
    ].join('\n')
    // Order is members-in-declaration-order with parents first; the gate compares SETS.
    expect(componentProps(src)!.sort()).toEqual(['hr', 'label', 'onUpgrade', 'state'])
  })

  it('a union whose members resolve to NOTHING stays null, not propless', () => {
    // The empty-vs-unparseable distinction this file records for `SiteFooter`, applied to the
    // union path: a member we cannot find is not a component that takes no props.
    const src = [
      'export type XProps =',
      '  | Missing',
      '  | AlsoMissing',
      '',
      'export default function X(props: XProps) {}',
    ].join('\n')
    expect(componentProps(src)).toBeNull()
  })

  it('a ONE-LINE interface yields every member, not just the first', () => {
    // Three of TrendCard's five union members are written on one line, so a newline-only split
    // dropped `sessionLabel` and `onUpgrade` SILENTLY and then reported them as props the
    // contract had invented.
    expect(componentProps(
      'interface Props { a: string; b?: number; c: boolean }\nexport default function X(p: Props) {}',
    )).toEqual(['a', 'b', 'c'])
  })

  it('🔴 a NESTED inline object type does not leak its fields as top-level props', () => {
    // A plain `;` split descended into `lifts?: { … }` and contributed `today`, `units`, `onLog`
    // and `ended_at` to `StrengthGuidedSessionProps` — two EXISTING contracts went red within
    // one run. Depth tracking is the fix; the semicolon alone is a regression.
    expect(componentProps([
      'interface Props {',
      '  outer: string',
      "  lifts?: { suggestions: Record<string, S>; today: Record<string, L>; units: 'km' | 'mi' }",
      '  after: number',
      '}',
      'export default function X(p: Props) {}',
    ].join('\n'))).toEqual(['outer', 'lifts', 'after'])
  })

  it('🔴 an ARROW TYPE BEFORE a nested object does not reopen the leak', () => {
    // ⚠️ ORDER-DEPENDENT, AND MY OWN PROBE OF THE SPLITTER PASSED BECAUSE IT HAD THE TWO MEMBERS
    // THE OTHER WAY ROUND. Counting `<`/`>` as brackets looks right for `Record<string, X>` and
    // is wrong for `=>`: the arrow's `>` decremented with no matching `<`, so depth sat at -1
    // for the rest of the interface and a LATER nested `;` split at "depth 0". `<`/`>` are not
    // tracked at all now, and depth is clamped at 0.
    expect(componentProps([
      'interface Props {',
      '  onSet: (v: string | null) => Promise<boolean>',
      "  lifts?: { today: Record<string, L>; units: 'km' | 'mi' }",
      '}',
      'export default function X(p: Props) {}',
    ].join('\n')), 'the arrow must come FIRST for this to fire').toEqual(['onSet', 'lifts'])
  })

  it('contractProps reads both block shapes, and a GENERIC name', () => {
    const fence = (body: string) => '## Prop interface\n\n```typescript\n' + body + '\n```\n'
    expect(contractProps(fence('interface XProps {\n  a: string\n  b?: number\n}'))).toEqual(['a', 'b'])
    expect(contractProps(fence('type XProps = {\n  a: string\n}'))).toEqual(['a'])
    expect(contractProps(fence('interface XProps<T extends string> {\n  value: T\n}')),
      'a contract may name a generic component faithfully').toEqual(['value'])
    expect(contractProps('no fence here'), 'no block at all').toBeNull()
    expect(contractProps(fence('interface XProps {\n  // a comment is not a prop\n  a: string\n}')))
      .toEqual(['a'])
  })
})
