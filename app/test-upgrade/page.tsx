'use client'

// TEMPORARY TEST ROUTE — delete after purchase flow is verified.
// Navigate to /test-upgrade in the simulator to see the UpgradeScreen.

import { useRouter } from 'next/navigation'
import UpgradeScreen from '@/app/dashboard/UpgradeScreen'

export default function TestUpgradePage() {
  const router = useRouter()
  return <UpgradeScreen onBack={() => router.push('/dashboard')} trialExpired={false} />
}
