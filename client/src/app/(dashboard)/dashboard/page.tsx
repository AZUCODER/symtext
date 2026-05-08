import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { ChartAreaInteractive } from "@/components/dashboard/chart-area-interactive"
import { DataTable } from "@/components/dashboard/data-table"
import { DashboardSearch } from "@/components/dashboard/dashboard-search"
import { SectionCards } from "@/components/dashboard/section-cards"
import { requireDashboardUser } from "@/lib/dashboard-auth"

import data from "./data.json"

export default async function Page() {
  const { user: currentUser } = await requireDashboardUser("/dashboard")

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email }}>
      <DashboardSearch />
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DataTable data={data} />
    </DashboardShell>
  )
}
