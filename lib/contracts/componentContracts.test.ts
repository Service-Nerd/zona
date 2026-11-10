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
  const ifaceRe = (name: string) => new RegExp('interface ' + name + ' \\{([\\s\\S]*?)\\n\\}')
  const readIface = (body: string): string[] =>
    body.split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => (l.match(/^([A-Za-z_$][\w$]*)\s*\??\s*:/) || [])[1]).filter(Boolean) as string[]

  const named = src.match(ifaceRe('Props'))
    ?? (defaultName ? src.match(ifaceRe(`${defaultName}Props`)) : null)
  if (named) return readIface(named[1])

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
