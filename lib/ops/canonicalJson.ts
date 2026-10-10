/**
 * Key-order-independent canonical JSON, for comparing a value we WROTE against the
 * value the database GIVES BACK.
 *
 * 🔴 WHY THIS EXISTS, AND IT COST A REVERTED PRODUCTION WRITE.
 * `plan_json` is **jsonb**, and jsonb does not preserve object key order — it
 * normalises to (key length, then bytewise). `BASEBUILD-GENINPUT-REMEDIATION-01`'s
 * post-write check compared `JSON.stringify(fromDb) === JSON.stringify(whatIWrote)`.
 * The stamp is built in `GeneratorInput` DECLARATION order and comes back in jsonb
 * order, so the strings differed on **every** row while every value was correct.
 * Measured on 25 already-stamped production plans: the returned key order matches
 * jsonb normalisation exactly and does NOT match declaration order.
 *
 * The write was right and the CHECK was wrong — so it failed safe, auto-reverted two
 * live plans, and reported `stamp=❌`. **Failing safe is the correct behaviour and a
 * false negative is still a defect**: a verification that cannot pass on correct data
 * teaches you to bypass it, which is how this repo's own record says a guard dies.
 *
 * ⚠️ IT MUST NOT BE WEAKER THAN THE STRING COMPARE IT REPLACES. Sorting keys
 * recursively is the whole change: a missing key, an extra key, a changed value, a
 * changed type or a reordered ARRAY all still differ. **Array order is preserved**,
 * deliberately — `days_cannot_train` and `injury_history` are lists whose order is
 * data, and sorting them would hide a real change.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalise(value))
}

function canonicalise(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalise)          // order PRESERVED — see above
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    // `Array.from`, never a spread over an iterator — CLAUDE.md § TypeScript.
    return Object.keys(o).sort().reduce((acc, k) => {
      acc[k] = canonicalise(o[k])
      return acc
    }, {} as Record<string, unknown>)
  }
  return v
}

/** True when two values are the same JSON document, whatever order their keys arrived in. */
export function jsonEquivalent(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b)
}
