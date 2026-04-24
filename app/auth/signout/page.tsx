'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function SignOutPage() {
  useEffect(() => {
    createClient().auth.signOut().then(() => {
      window.location.href = '/auth/login'
    })
  }, [])

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--bg)',
      fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--mute)',
    }}>
      Signing out…
    </div>
  )
}
