import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { join } from 'path'

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
  // Prefer an explicit `interface Props` — it carries the types too.
  const iface = src.match(/interface Props \{([\s\S]*?)\n\}/)
  if (iface) {
    return iface[1].split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => (l.match(/^([A-Za-z_$][\w$]*)\s*\??\s*:/) || [])[1]).filter(Boolean) as string[]
  }
  // ⚠️ NAMED EXPORTS TOO, and the reason is a real miss. This matched only
  // `export default function`, and every marketing component in this codebase
  // is a NAMED export — so registering a contract for one produced "could not
  // read props" rather than a comparison. A parser that only understands one
  // export style silently declines to check the other, which is the same
  // "only as wide as its list" shape as the three audit checks widened
  // earlier today. Found 2026-09-21 by registering contracts for HrTrace,
  // Section, TabbedPhone and PhoneShell.
  const m = src.match(/export (?:default )?function \w+\s*\(\s*\{([\s\S]*?)\}\s*:/)
  if (!m) return null
  // Split on TOP-LEVEL commas: a one-line destructure and a multi-line one must
  // parse the same, and `state = 'future'` / nested shapes must not split.
  const parts: string[] = []
  let depth = 0, cur = ''
  for (const ch of m[1]) {
    if ('([{<'.includes(ch)) depth++
    else if (')]}>'.includes(ch)) depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map(p => (p.trim().match(/^([A-Za-z_$][\w$]*)/) || [])[1]).filter(Boolean) as string[]
}

/** Prop names the CONTRACT documents, from its first fenced interface block. */
function contractProps(md: string): string[] | null {
  // Accept both shapes a real component uses: `interface Props {` and
  // `type Props = {`. Matching only one of them makes the gate depend on a
  // stylistic choice in the file it is checking.
  const block = md.match(/```(?:typescript|ts)\s*\n[\s\S]*?(?:interface \w+ \{|type \w+ = \{)([\s\S]*?)\n\}\s*\n```/)
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
