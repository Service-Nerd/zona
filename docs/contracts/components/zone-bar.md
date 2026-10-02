# Contract — ZoneBar

**Authority**: This document defines the five-segment zone bar's props. Any change must update
this document in the same commit — `lib/contracts/componentContracts.test.ts` compares the two
prop-for-prop, both directions.

**Component:** `components/shared/ZoneBar.tsx`

```typescript
interface ZoneBarProps {
  /** The active zone (1–5). The other four segments render in --bg-soft. */
  activeZone?: Zone
  /** A prescribed zone RANGE — every zone in the array lights, each in its own
   *  colour. For mixed-intensity quality sessions ("Zone 4–5").
   *  TAKES PRECEDENCE over `activeZone`. §84 — the header shows the real prescription. */
  activeZones?: Zone[]
  /** Segment height in px. Default 4 (session card). 6 on Session Detail. */
  height?: number
  /** Show the 1–5 number labels under the bar. Off on the session card,
   *  on for Session Detail's prescription card. */
  showLabels?: boolean
  /** Extra inline style on the container — spacing only. */
  style?: React.CSSProperties
}
```

## 🔴 `activeZones` beats `activeZone`, and that precedence is a coaching rule

§84: **the header shows the real prescription.** A mixed-intensity quality session is prescribed
as a range, so passing both and expecting the single zone to win would show the runner a
narrower prescription than the one they were given. **Do not "simplify" this to one prop.**

## The zone model is Zonna's, not Seiler's

`Zone = 1 | 2 | 3 | 4 | 5`, and the colours come from the session-type tokens:

| Zone | Token | Meaning |
|---|---|---|
1 | `--s-recov` | Recovery |
2 | `--s-easy` | **Easy — where aerobic adaptation happens** |
3 | `--s-quality` | **The grey zone the whole brand exists to prevent** |
4 | `--s-race` | Race pace |
5 | `--s-inter` | Intervals |

⚠️ **Z2 is easy and Z3 is the grey zone.** Seiler's three-zone model calls the *moderate* band
"Zone 2", which is the opposite meaning of the same label (INV-COACH-004). Any external
reasoning about "too much Zone 2" must be translated before it reaches this component.

## `zoneNumberForType()`

Exported alongside: maps a session `type` string to a `Zone | null`. It returns **`null`, never
a default zone**, for a type it does not recognise — a bar showing Zone 1 for an unknown session
is a claim, and `null` renders no active segment.

## What this contract does not cover

Which surfaces render the bar and at what height; and whether the zone shown matches the HR
target beside it, which `displayZoneMatchesHr.test.ts` owns. Nothing here has run on a device.
