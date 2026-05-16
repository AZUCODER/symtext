import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { FinanceTransactions } from "@/components/dashboard/finance-transactions"
import { requireDashboardUser } from "@/lib/dashboard-auth"

export default async function FinanceTransactionsPage() {
  const { user: currentUser } = await requireDashboardUser("/dashboard/finance-transactions")

  if (currentUser.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <DashboardShell user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}>
      <FinanceTransactions />
    </DashboardShell>
  )
}
