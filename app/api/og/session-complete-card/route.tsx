import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { BRAND } from '@/lib/brand'
import { loadFont, splitOnDoubleLetter } from '@/lib/brand-og'
import { getCompletionCopy } from '@/lib/coaching/completionCopy'
import { computeLedger } from '@/lib/coaching/disciplineLedger'
import { getSessionLabel } from '@/lib/session-types'
import type { Plan } from '@/types/plan'

// SAVE-IMG-01 — Shareable end-of-session zone card.
//
// GET /api/og/session-complete-card?week_n=N&session_day=DAY
//
// Auth-gated (any tier). Renders the same content as the in-app
// SessionCompleteCard at 1080×1920 (Instagram story aspect) — Kahneman
// peak-end artefact, screenshot-by-default in-app, file-share via this
// route when the runner wants higher-fidelity export.
//
// Two render states (mirror the in-app card):
//   State A — `run_analysis.hr_in_zone_pct` exists → TIME IN ZONE % +
//             5-segment ZoneBar + RPE chip + fatigue chip.
//   State B — no analysis → EFFORT RPE / 10 + fatigue chip.
//
// DOCTRINE-01: when the discipline ledger advanced this week, the brand
// statement appears quietly at the bottom of the card. Same conditional
// as the in-app SessionCompleteCard.
//
// Runtime: nodejs (auth-admin read of auth.users is not edge-safe). The
// route runs at story-aspect (1080×1920) only at v1; no 1200×630 social
// variant — narrows scope to "screenshot sharing".

export const runtime = 'nodejs'

const STORY_W = 1080
const STORY_H = 1920

// Format date as "Wed · 22 May" — matches the in-app card. Three-letter
// month + weekday; reads at thumbnail size in social shares.
const WEEKDAY_ABBREV = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBREV   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function formatDate(d: Date): string {
  return `${WEEKDAY_ABBREV[d.getUTCDay()]} · ${d.getUTCDate()} ${MONTH_ABBREV[d.getUTCMonth()]}`
}

// Zone colour at the OG hex layer — paralleled from components/shared/ZoneBar.tsx.
// Five segments, one filled. Resolved hex (no CSS vars in next/og).
const ZONE_COLOURS = ['#4E8068', '#3D6FB0', '#B8853A', '#C86A2A', '#B84545'] as const
type Zone = 1 | 2 | 3 | 4 | 5
function zoneNumberForType(type: string): Zone | null {
  switch (type) {
    case 'recovery':                          return 1
    case 'easy': case 'run': case 'long':     return 2
    case 'quality': case 'tempo':             return 3
    case 'race':                              return 4
    case 'intervals': case 'hard':            return 5
    default:                                  return null
  }
}

// Fatigue tag → resolved hex pair. Mirrors fatigueChipColour in the in-app
// SessionCompleteCard; resolved values because CSS vars don't work in next/og.
const FATIGUE_COLOURS: Record<string, string> = {
  Fresh:   '#4E8068',  // --s-recov
  Fine:    '#3D6FB0',  // --s-easy
  Heavy:   '#B8853A',  // --warn
  Wrecked: '#B84545',  // --s-inter
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const weekNParam = req.nextUrl.searchParams.get('week_n')
  const sessionDay = req.nextUrl.searchParams.get('session_day')
  const weekN = weekNParam ? parseInt(weekNParam, 10) : NaN
  if (!Number.isFinite(weekN) || !sessionDay) {
    return NextResponse.json({ error: 'week_n and session_day required' }, { status: 422 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const tier = await getUserTier(user.id)

  // Pull the three inputs we need in parallel.
  const [completionRes, analysisRes, planRes, allCompletionsRes, allAnalysesRes] = await Promise.all([
    service.from('session_completions')
      .select('week_n, session_day, status, rpe, fatigue_tag, updated_at')
      .eq('user_id', user.id)
      .eq('week_n', weekN)
      .eq('session_day', sessionDay)
      .maybeSingle(),
    service.from('run_analysis')
      .select('week_n, session_day, hr_in_zone_pct')
      .eq('user_id', user.id)
      .eq('week_n', weekN)
      .eq('session_day', sessionDay)
      .maybeSingle(),
    service.from('plans').select('plan_json').eq('user_id', user.id).maybeSingle(),
    // Ledger inputs — same shape as /api/discipline-ledger uses.
    service.from('session_completions')
      .select('week_n, session_day, status, fatigue_tag')
      .eq('user_id', user.id),
    tier === 'free'
      ? Promise.resolve({ data: [] as any[] })
      : service.from('run_analysis')
          .select('week_n, hr_in_zone_pct')
          .eq('user_id', user.id),
  ])

  const completion = completionRes.data ?? null
  if (!completion) {
    return NextResponse.json({ error: 'No completion for that slot' }, { status: 404 })
  }

  const plan      = (planRes.data?.plan_json ?? null) as Plan | null
  const planWeek  = plan?.weeks?.find(w => w.n === weekN) ?? null
  const planSlot  = planWeek?.sessions?.[sessionDay as keyof typeof planWeek.sessions] ?? null
  const sessionType = (planSlot?.type as string) ?? 'easy'

  const ledger = computeLedger({
    plan,
    completions: allCompletionsRes.data ?? [],
    analyses:    (allAnalysesRes.data ?? []) as any[],
    tier,
    asOfDate:    new Date(),
  })

  const completionCopy = getCompletionCopy(sessionType)
  const zonePctRaw     = analysisRes.data?.hr_in_zone_pct
  const zonePct        = zonePctRaw != null ? Math.round(Number(zonePctRaw)) : null
  const zone           = zoneNumberForType(sessionType)
  const showZone       = zonePct != null && zone != null
  const rpe            = (completion.rpe as number | null) ?? null
  const fatigueTag     = (completion.fatigue_tag as string | null) ?? null
  const dateLabel      = formatDate(new Date(completion.updated_at as string))
  const chipLabel      = getSessionLabel(sessionType)

  const [interBlack, interBold, interSemi, interRegular] = await Promise.all([
    loadFont('Inter', 800),
    loadFont('Inter', 700),
    loadFont('Inter', 600),
    loadFont('Inter', 400),
  ])

  const split = splitOnDoubleLetter(BRAND.name)
  const wordmark = split
    ? (
        <span style={{ display: 'flex' }}>
          {split[0]}
          <span style={{ color: BRAND.og.moss }}>{split[1]}</span>
          {split[2]}
        </span>
      )
    : <span>{BRAND.name}</span>

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BRAND.og.bg,
          padding: '96px 80px',
          position: 'relative',
          fontFamily: 'Inter',
        }}
      >
        {/* Concentric-rings watermark — same vocabulary as the other OG
            routes so the brand reads consistently across surfaces. */}
        <svg
          viewBox="0 0 1024 1024"
          width={1280}
          height={1280}
          style={{ position: 'absolute', right: -360, top: 280, opacity: 0.06 }}
        >
          <circle cx={512} cy={512} r={440} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={355} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={270} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={185} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={80}  fill={BRAND.og.ink} />
        </svg>

        {/* Top — wordmark on left, session chip + date stacked on right. */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 64,
              fontWeight: 800,
              color: BRAND.og.ink,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              display: 'flex',
            }}
          >
            {wordmark}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12 }}>
            <span style={{
              display: 'inline-block',
              fontFamily: 'Inter', fontSize: 22, fontWeight: 700,
              color: BRAND.og.ink, background: '#EDE9E1',
              padding: '10px 22px', borderRadius: 999,
              letterSpacing: '0.12em', textTransform: 'uppercase',
            }}>
              {chipLabel}
            </span>
            <span style={{ fontFamily: 'Inter', fontSize: 26, fontWeight: 400, color: BRAND.og.mute }}>
              {dateLabel}
            </span>
          </div>
        </div>

        {/* Middle — hero metric stack. Centred on the canvas (the in-app
            card is left-aligned, but a poster reads better centred at
            story aspect). */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 28 }}>
          <div
            style={{
              fontFamily: 'Inter', fontSize: 28, fontWeight: 700,
              color: BRAND.og.mute,
              letterSpacing: '0.18em', textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            {showZone ? 'Time in zone' : 'Effort'}
          </div>

          {showZone ? (
            <>
              <div
                style={{
                  display: 'flex', alignItems: 'baseline',
                  fontFamily: 'Inter', letterSpacing: '-0.05em',
                  lineHeight: 0.9,
                }}
              >
                <span style={{ fontSize: 320, fontWeight: 800, color: BRAND.og.ink }}>
                  {zonePct}
                </span>
                <span style={{ fontSize: 120, fontWeight: 600, color: BRAND.og.moss, marginLeft: 12 }}>
                  %
                </span>
              </div>
              {/* ZoneBar 5-segment row. Each segment scaled 3x from the in-app
                  height (5 → 15) and the gap (3 → 9). */}
              <div style={{ display: 'flex', width: 720, gap: 9 }}>
                {[1, 2, 3, 4, 5].map(z => (
                  <div
                    key={z}
                    style={{
                      flex: 1,
                      height: 15,
                      borderRadius: 4,
                      background: z === zone ? ZONE_COLOURS[zone - 1] : '#EDE9E1',
                    }}
                  />
                ))}
              </div>
            </>
          ) : (
            <div
              style={{
                display: 'flex', alignItems: 'baseline', gap: 18,
                fontFamily: 'Inter', letterSpacing: '-0.05em', lineHeight: 0.9,
              }}
            >
              <span style={{ fontSize: 320, fontWeight: 800, color: BRAND.og.ink, fontVariantNumeric: 'tabular-nums' }}>
                {rpe ?? '—'}
              </span>
              <span style={{ fontSize: 120, fontWeight: 600, color: BRAND.og.mute }}>
                / 10
              </span>
            </div>
          )}

          {/* Fatigue chip — beneath the metric in both states when set.
              Resolved hex pair so color-mix isn't needed. */}
          {fatigueTag && FATIGUE_COLOURS[fatigueTag] && (
            <span style={{
              display: 'inline-block',
              fontFamily: 'Inter', fontSize: 28, fontWeight: 600,
              color: FATIGUE_COLOURS[fatigueTag],
              background: '#FFFFFF',
              border: `3px solid ${FATIGUE_COLOURS[fatigueTag]}`,
              padding: '14px 32px', borderRadius: 999,
            }}>
              {fatigueTag}
            </span>
          )}

          {/* Completion copy block — headline + body. Hand-authored
              (rule-engine output), so no AIMark on the artefact. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880 }}>
            <div style={{
              fontFamily: 'Inter', fontSize: 56, fontWeight: 700,
              color: BRAND.og.ink, letterSpacing: '-0.02em', lineHeight: 1.15,
              display: 'flex',
            }}>
              {completionCopy.headline}
            </div>
            <div style={{
              fontFamily: 'Inter', fontSize: 32, fontWeight: 400,
              color: BRAND.og.mute, lineHeight: 1.45,
              display: 'flex',
            }}>
              {completionCopy.body}
            </div>
          </div>
        </div>

        {/* Bottom — voice anchor stamp + conditional brand statement
            (DOCTRINE-01). Hairline separates the two stamps when both
            render. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            fontFamily: 'Inter', fontSize: 30, fontWeight: 700,
            color: BRAND.og.ink, letterSpacing: '0.14em', textTransform: 'uppercase',
            display: 'flex',
          }}>
            {BRAND.voiceAnchor}
          </div>
          {ledger.advancedThisWeek && (
            <>
              <div style={{ height: 2, width: 240, background: '#1A1A1A14' }} />
              <div style={{
                fontFamily: 'Inter', fontSize: 22, fontWeight: 700,
                color: BRAND.og.mute, letterSpacing: '0.14em', textTransform: 'uppercase',
                display: 'flex',
              }}>
                {BRAND.brandStatement}
              </div>
            </>
          )}
        </div>
      </div>
    ),
    {
      width: STORY_W,
      height: STORY_H,
      fonts: [
        { name: 'Inter', data: interBlack,   style: 'normal', weight: 800 },
        { name: 'Inter', data: interBold,    style: 'normal', weight: 700 },
        { name: 'Inter', data: interSemi,    style: 'normal', weight: 600 },
        { name: 'Inter', data: interRegular, style: 'normal', weight: 400 },
      ],
    },
  )
}
