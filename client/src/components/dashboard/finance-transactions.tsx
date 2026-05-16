"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { getBillingTransactions, runBillingReconciliation } from "@/lib/billing-client"
import type { BillingProvider, BillingTransactionStatus } from "@/lib/dashboard-types"
import { queryKeys } from "@/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function formatAmount(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function FinanceTransactions() {
  const queryClient = useQueryClient()
  const [provider, setProvider] = useState<"all" | BillingProvider>("all")
  const [status, setStatus] = useState<"all" | BillingTransactionStatus>("all")
  const [customer, setCustomer] = useState("")
  const [submittedCustomer, setSubmittedCustomer] = useState("")
  const [reconcileFeedback, setReconcileFeedback] = useState<string | null>(null)

  const queryParams = useMemo(
    () => ({
      ...(provider !== "all" ? { provider } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(submittedCustomer.trim() ? { customer: submittedCustomer.trim() } : {}),
    }),
    [provider, status, submittedCustomer],
  )

  const transactionsQuery = useQuery({
    queryKey: queryKeys.billingTransactions(queryParams),
    queryFn: () => getBillingTransactions(queryParams),
    staleTime: 15_000,
  })

  const reconcileMutation = useMutation({
    mutationFn: () => runBillingReconciliation({ older_than_minutes: 15, limit: 200 }),
    onSuccess: async (result) => {
      setReconcileFeedback(
        `Reconcile completed: scanned ${result.scanned}, updated ${result.updated}, skipped ${result.skipped_unsupported_provider}.`,
      )
      queryClient.setQueryData(queryKeys.billingReconcile, result)
      await queryClient.invalidateQueries({ queryKey: queryKeys.billingTransactions(queryParams) })
    },
    onError: (error) => {
      setReconcileFeedback(error instanceof Error ? error.message : "Failed to run reconciliation")
    },
  })

  const reconcileResult = queryClient.getQueryData<{
    scanned: number
    updated: number
    skipped_unsupported_provider: number
    items: {
      transaction_id: string
      provider: BillingProvider
      previous_status: BillingTransactionStatus
      new_status: BillingTransactionStatus
      provider_transaction_id: string
    }[]
  }>(queryKeys.billingReconcile)

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Finance Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FieldGroup>
            <div className="grid gap-3 md:grid-cols-4">
              <Field>
                <FieldLabel htmlFor="finance-provider">Provider</FieldLabel>
                <Select value={provider} onValueChange={(value) => setProvider(value as "all" | BillingProvider)}>
                  <SelectTrigger id="finance-provider" className="h-10 w-full rounded-md border-input bg-input/20 px-3 text-sm data-[size=default]:h-10">
                    <SelectValue placeholder="All providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="alipay">Alipay</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="finance-status">Status</FieldLabel>
                <Select value={status} onValueChange={(value) => setStatus(value as "all" | BillingTransactionStatus)}>
                  <SelectTrigger id="finance-status" className="h-10 w-full rounded-md border-input bg-input/20 px-3 text-sm data-[size=default]:h-10">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">pending</SelectItem>
                    <SelectItem value="succeeded">succeeded</SelectItem>
                    <SelectItem value="failed">failed</SelectItem>
                    <SelectItem value="refunded">refunded</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="finance-customer">Customer Email / ID</FieldLabel>
                <Input
                  id="finance-customer"
                  value={customer}
                  onChange={(event) => setCustomer(event.target.value)}
                  placeholder="Search payer email or customer id"
                />
              </Field>

              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={() => setSubmittedCustomer(customer)}
                  disabled={transactionsQuery.isFetching || reconcileMutation.isPending}
                  className="w-full"
                >
                  {transactionsQuery.isFetching ? "Filtering..." : "Apply Filters"}
                </Button>
              </div>
            </div>
          </FieldGroup>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReconcileFeedback(null)
                reconcileMutation.mutate()
              }}
              disabled={reconcileMutation.isPending}
            >
              {reconcileMutation.isPending ? "Reconciling..." : "Run Reconciliation"}
            </Button>
            <p className="text-sm text-muted-foreground">Checks old pending payments and syncs provider status.</p>
          </div>

          <div className="rounded-md border border-border/70">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="px-3 py-2">Occurred At</th>
                    <th className="px-3 py-2">Payer Email</th>
                    <th className="px-3 py-2">Customer ID</th>
                    <th className="px-3 py-2">Provider</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Provider Transaction</th>
                    <th className="px-3 py-2">Order Ref</th>
                    <th className="px-3 py-2">Subscription Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactionsQuery.data?.items ?? []).map((item) => (
                    <tr key={item.id} className="border-t border-border/60">
                      <td className="px-3 py-2">{new Date(item.occurred_at).toLocaleString()}</td>
                      <td className="px-3 py-2">{item.user_email ?? "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{item.customer_id ?? "-"}</td>
                      <td className="px-3 py-2">{item.provider}</td>
                      <td className="px-3 py-2">{item.transaction_type}</td>
                      <td className="px-3 py-2">{formatAmount(item.amount_minor, item.currency)}</td>
                      <td className="px-3 py-2">{item.status_canonical}</td>
                      <td className="px-3 py-2 font-mono text-xs">{item.provider_transaction_id}</td>
                      <td className="px-3 py-2 font-mono text-xs">{item.provider_order_id ?? "-"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{item.provider_subscription_id ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {transactionsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Loading billing transactions...</p>
          )}
          {transactionsQuery.error instanceof Error && (
            <p className="text-sm text-destructive">{transactionsQuery.error.message}</p>
          )}
          {reconcileFeedback && <p className="text-sm text-muted-foreground">{reconcileFeedback}</p>}
          {!transactionsQuery.isLoading && !transactionsQuery.error && (
            <p className="text-sm text-muted-foreground">
              {transactionsQuery.data?.total ?? 0} transaction(s) found.
            </p>
          )}

          {reconcileResult && reconcileResult.items.length > 0 && (
            <div className="rounded-md border border-border/70 p-3 text-sm">
              <p className="mb-2 font-medium">Last Reconciliation Updates</p>
              <div className="space-y-1">
                {reconcileResult.items.slice(0, 20).map((item) => (
                  <p key={item.transaction_id} className="font-mono text-xs">
                    {item.provider}:{item.provider_transaction_id} {item.previous_status} -&gt; {item.new_status}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
