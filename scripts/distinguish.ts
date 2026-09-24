// distinguish.ts — GATE-FALSIFY-01 (d).
//
// "Does this verification predicate actually tell the two states apart?"
//
// 🔴 THE INCIDENT, 2026-09-24. A migration could not be applied from here (CLI
// unlinked, sandbox refuses production writes), so the founder was handed a query
// to prove it had landed:
//
//     select pg_get_functiondef('public.purge_user_side_channels'::regproc)
//            like '%charity_codes%' as still_clears_charity;   -- false = applied
//
// It came back `true` and a GOOD migration was nearly declared failed. The
// replacement function names `charity_codes` THREE TIMES IN ITS OWN EXPLANATORY
// COMMENTS, so the predicate returns `true` whether or not the change applied.
// **The check was reading the explanation of the fix and reporting it as the bug.**
//
// ⚠️ WHY THAT ONE GOT THROUGH WHEN TWO OTHERS THE SAME DAY DID NOT. The hollow
// checks written IN CODE were caught by mutation — break the thing, watch it go
// red. This one ran on someone else's machine, so it could not be mutated. **A
// verification step handed to a human is untested code**, and it is the likeliest
// place a hollow check survives.
//
// Both artifacts were on disk the whole time: the old migration and the new one.
// One command would have shown the predicate could not discriminate.
//
// ── USAGE ────────────────────────────────────────────────────────────────────
//
//   npm run distinguish -- --before <fileA> --after <fileB> --predicate '<cmd>'
//
// `{}` in the predicate is replaced with the file path. The predicate runs
// against BOTH files; stdout and exit status are compared.
//
//   answers DIFFER  -> exit 0. The predicate discriminates; it is safe to send.
//   answers MATCH   -> exit 1. It returns the same thing either way — it is not
//                      a check, and sending it invites the wrong conclusion.
//
// ⚠️ EXPRESS THE PREDICATE AS THE BOOLEAN IT ACTUALLY IS. This is the tool's real
// work, and it is the same discipline as `toContain` vs `toMatch`:
//
//   grep -c charity_codes {}                        -> 2 vs 3  (looks fine, LIES)
//   grep -q charity_codes {} && echo t || echo f     -> t vs t  (the actual bug)
//
// The first counts; the SQL predicate was a boolean. A predicate tested in a
// different shape from the one it will be evaluated in is not the predicate.
//
// ⚠️ WHAT THIS CANNOT DO. A predicate about LIVE DATA — row counts, a webhook's
// state — has no local before/after to compare, and nothing here helps. For those,
// state what each outcome means INCLUDING what it returns if nothing happened.
// "No rows returned" from an UPDATE is not "zero rows matched"; that misread
// happened the same day and this tool would not have caught it either.
//
// Run: npm run distinguish -- --before a --after b --predicate 'grep -q x {} && echo t || echo f'

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

interface Outcome { stdout: string; code: number }

export function runPredicate(predicate: string, file: string): Outcome {
  const cmd = predicate.includes('{}') ? predicate.split('{}').join(JSON.stringify(file)) : `${predicate} ${JSON.stringify(file)}`
  try {
    const stdout = execSync(cmd, { encoding: 'utf8', timeout: 30_000, stdio: ['ignore', 'pipe', 'pipe'] })
    return { stdout: stdout.trim(), code: 0 }
  } catch (e) {
    const err = e as { stdout?: string; status?: number }
    return { stdout: (err.stdout ?? '').trim(), code: err.status ?? 1 }
  }
}

/** The whole judgement: same stdout AND same exit status means it cannot tell them apart. */
export function discriminates(a: Outcome, b: Outcome): boolean {
  return !(a.stdout === b.stdout && a.code === b.code)
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

function main(): never {
  const before = arg('--before')
  const after = arg('--after')
  const predicate = arg('--predicate')
  if (!before || !after || !predicate) {
    console.error("usage: npm run distinguish -- --before <file> --after <file> --predicate '<cmd with {}>'")
    console.error('  exit 0 = the predicate tells them apart · exit 1 = it does NOT (do not send it)')
    process.exit(64)
  }
  for (const f of [before, after]) {
    if (!existsSync(f)) { console.error(`no such file: ${f}`); process.exit(64) }
  }

  const a = runPredicate(predicate, before)
  const b = runPredicate(predicate, after)

  console.log(`predicate: ${predicate}\n`)
  console.log(`  before (${before})`)
  console.log(`    stdout: ${JSON.stringify(a.stdout)}   exit: ${a.code}`)
  console.log(`  after  (${after})`)
  console.log(`    stdout: ${JSON.stringify(b.stdout)}   exit: ${b.code}\n`)

  if (!discriminates(a, b)) {
    console.error('✗ IDENTICAL — this predicate returns the same answer in both states.')
    console.error('  It is not a check. Sending it invites the wrong conclusion, which is')
    console.error('  exactly how a good migration was nearly declared failed on 2026-09-24.')
    console.error('  Match the STATEMENT or the VALUE, not a word that may appear in a')
    console.error("  comment, a doc-string, or your own explanation of the change.")
    process.exit(1)
  }
  console.log('✓ DISTINGUISHES — the two states give different answers. Safe to hand over.')
  process.exit(0)
}

if (process.argv[1] && /distinguish\.ts$/.test(process.argv[1])) main()
