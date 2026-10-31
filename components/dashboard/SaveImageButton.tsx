'use client'

// DASHBOARD-SCREEN-EXTRACT-04 — lifted out of `DashboardClient.tsx`.

import ShareControl from '@/components/shared/ShareControl'

// SAVE-IMG-01 — rendered BELOW SessionCompleteCard (never inside), so the runner's
// iOS screenshot of the card stays clean. SHARE-ICON-01: the control is the shared
// icon owner; this only says WHAT is shared.
export default function SaveImageButton({ weekN, sessionDay }: { weekN: number; sessionDay: string }) {
  return (
    <ShareControl ariaLabel="Share this run" share={async onStatus => {
      const { shareSessionCompleteCard } = await import('@/lib/share/shareSessionCompleteCard')
      await shareSessionCompleteCard({ weekN, sessionDay, onStatus })
    }} />
  )
}
