import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { BRAND } from '@/lib/brand'
import { loadFont, splitOnDoubleLetter } from '@/lib/brand-og'

// SHARE-01 — Shareable weekly zone-discipline card.
//
// GET /api/og/weekly-zone-card[?week_n=<n>]
//
// Auth-gated (paid/trial only). Free users have no card — the Coach tab
// renders an upsell card instead. The route returns a 1080×1920 PNG (Instagram
// story dimensions); social-card aspect (1200×630) is intentionally NOT
// supported at v1 — the spec narrows to story share + screenshot share.
//
// Source data:
//   weekly_reports.zone_discipline_score (0–100)
//   weekly_reports.dominant_flag           ('ok' | 'watch' | 'flag')
//   auth.users.created_at                  (for the tenure caption)
//
// Tenure caption rules (per spec, hard requirements):
//   - "Holding the zone since {Mmm YYYY}"  — three-letter month + four-digit year
//   - Suppressed entirely when account is within the current calendar month
//   - NEVER the words "member", "subscriber", "anniversary", "milestone"
//
// Layout (1080×1920):
//   Top:      Zonna wordmark (Inter 800).
//   Middle:   the zone-discipline % at display size, with verdict line beneath.
//   Bottom:   BRAND.voiceAnchor ("Hold the zone.") small caption + tenure line.
//
// Colour: BRAND.og.* — resolved Warm Slate hex (no CSS custom props in edge).

export const runtime = 'nodejs'

const STORY_W = 1080
const STORY_H = 1920

// --- helpers ----------------------------------------------------------------
// loadFont + splitOnDoubleLetter live in lib/brand-og.ts (shared across OG routes).

// Verdict line keyed by the weekly dominant_flag. Distinct from per-session
// getVerdictVoice() — a week is not a session. Kept short for the card slot.
function weeklyVerdictLine(score: number | null, dominantFlag: string | null): string {
  if (score == null) return 'Logged.'
  if (dominantFlag === 'flag') return "Bit hot. Worth a look."
  if (dominantFlag === 'watch') return "Held it most of the time."
  // ok / null → score-keyed
  if (score >= 85) return "Held the zone all week."
  if (score >= 70) return "Held it more than not."
  if (score >= 55) return "Mixed week. Stayed honest."
  return "Drifted more than you'd want."
}

const MONTH_ABBREV = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// "Holding the zone since Mmm YYYY". Returns null when the account was created
// in the current calendar month — spec requires suppression in that case.
function tenureCaption(createdAt: string | null, now: Date): string | null {
  if (!createdAt) return null
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return null
  if (
    created.getUTCFullYear() === now.getUTCFullYear() &&
    created.getUTCMonth()    === now.getUTCMonth()
  ) {
    return null
  }
  return `Holding the zone since ${MONTH_ABBREV[created.getUTCMonth()]} ${created.getUTCFullYear()}`
}

// --- route ------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (tier === 'free') {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const weekNParam = req.nextUrl.searchParams.get('week_n')
  const weekN      = weekNParam ? parseInt(weekNParam, 10) : null

  // Most recent generated weekly_report, or a specific week_n when requested.
  // We require a headline / score — a row with zone_discipline_score still
  // null (the rare case where the rule engine couldn't compute it from the
  // available data) is treated as "no card" and the route returns 404.
  let query = service
    .from('weekly_reports')
    .select('week_n, zone_discipline_score, dominant_flag, headline, generated_at')
    .eq('user_id', user.id)
    .not('generated_at', 'is', null)
    .order('week_n', { ascending: false })
    .limit(1)
  if (weekN != null && Number.isFinite(weekN)) query = query.eq('week_n', weekN)

  const { data: report } = await query.maybeSingle()
  if (!report || report.zone_discipline_score == null) {
    return NextResponse.json({ error: 'No weekly report yet' }, { status: 404 })
  }

  // auth.users.created_at — service-role read so RLS doesn't get in the way.
  const { data: authUser } = await service.auth.admin.getUserById(user.id)
  const createdAt = authUser?.user?.created_at ?? null
  const now       = new Date()
  const tenure    = tenureCaption(createdAt, now)

  const score   = report.zone_discipline_score as number
  const verdict = weeklyVerdictLine(score, report.dominant_flag as string | null)

  const [interBlack, interBold, interRegular] = await Promise.all([
    loadFont('Inter', 800),
    loadFont('Inter', 700),
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
          padding: '120px 96px',
          position: 'relative',
          fontFamily: 'Inter',
        }}
      >
        {/* Decorative concentric-rings watermark — same vocabulary as the
            social OG route so the brand reads consistently across surfaces. */}
        <svg
          viewBox="0 0 1024 1024"
          width={1280}
          height={1280}
          style={{ position: 'absolute', right: -340, top: 320, opacity: 0.07 }}
        >
          <circle cx={512} cy={512} r={440} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={355} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={270} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={185} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={80}  fill={BRAND.og.ink} />
        </svg>

        {/* Wordmark — top, anchored left. */}
        <div
          style={{
            fontFamily: 'Inter',
            fontSize: 72,
            fontWeight: 800,
            color: BRAND.og.ink,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          {wordmark}
        </div>

        {/* Middle stack — eyebrow, score, verdict line. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 28,
              fontWeight: 700,
              color: BRAND.og.mute,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Zone discipline · this week
          </div>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 320,
              fontWeight: 800,
              color: BRAND.og.ink,
              letterSpacing: '-0.05em',
              lineHeight: 0.9,
              display: 'flex',
              alignItems: 'baseline',
            }}
          >
            {score}
            <span
              style={{
                fontSize: 120,
                fontWeight: 800,
                color: BRAND.og.moss,
                marginLeft: 12,
              }}
            >
              %
            </span>
          </div>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 56,
              fontWeight: 700,
              color: BRAND.og.ink,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              maxWidth: 880,
              display: 'flex',
            }}
          >
            {verdict}
          </div>
        </div>

        {/* Bottom — voice anchor + tenure caption. Tenure suppressed when
            account was created in the current calendar month. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 36,
              fontWeight: 700,
              color: BRAND.og.ink,
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              display: 'flex',
            }}
          >
            {BRAND.voiceAnchor}
          </div>
          {tenure && (
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: 22,
                fontWeight: 400,
                color: BRAND.og.mute,
                letterSpacing: '0.04em',
                display: 'flex',
              }}
            >
              {tenure}
            </div>
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
        { name: 'Inter', data: interRegular, style: 'normal', weight: 400 },
      ],
    },
  )
}
