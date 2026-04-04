import { fetchPlan, getCurrentWeek } from '@/lib/plan'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const plan = await fetchPlan()
  const currentWeek = getCurrentWeek(plan.weeks)

  return <DashboardClient plan={plan} currentWeek={currentWeek} />
}
