import type {
  BillingGatewayConfig,
  BillingGatewayConfigUpdatePayload,
  BillingReconcileResponse,
  BillingTransactionListResponse,
} from "@/lib/dashboard-types"
import { withJsonHeaders } from "@/lib/http"

type ErrorPayload = {
  message?: string
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, cache: "no-store" })
  const payload = (await response.json().catch(() => null)) as (T & ErrorPayload) | null
  if (!response.ok) {
    throw new Error(payload?.message ?? `Request failed: ${response.status}`)
  }
  return (payload ?? {}) as T
}

export async function getBillingConfig(): Promise<BillingGatewayConfig> {
  return requestJson<BillingGatewayConfig>("/api/billing/config", { method: "GET" })
}

export async function updateBillingConfig(payload: BillingGatewayConfigUpdatePayload): Promise<BillingGatewayConfig> {
  return requestJson<BillingGatewayConfig>("/api/billing/config", {
    method: "PUT",
    headers: withJsonHeaders(),
    body: JSON.stringify(payload),
  })
}

export async function getBillingTransactions(params?: {
  provider?: string
  status?: string
  customer?: string
}): Promise<BillingTransactionListResponse> {
  const query = new URLSearchParams()
  if (params?.provider) {
    query.set("provider", params.provider)
  }
  if (params?.status) {
    query.set("status", params.status)
  }
  if (params?.customer) {
    query.set("customer", params.customer)
  }

  const input = `/api/billing/transactions${query.toString() ? `?${query.toString()}` : ""}`
  return requestJson<BillingTransactionListResponse>(input, { method: "GET" })
}

export async function runBillingReconciliation(params?: {
  older_than_minutes?: number
  limit?: number
}): Promise<BillingReconcileResponse> {
  const query = new URLSearchParams()
  if (typeof params?.older_than_minutes === "number") {
    query.set("older_than_minutes", String(params.older_than_minutes))
  }
  if (typeof params?.limit === "number") {
    query.set("limit", String(params.limit))
  }

  const input = `/api/billing/reconcile${query.toString() ? `?${query.toString()}` : ""}`
  return requestJson<BillingReconcileResponse>(input, { method: "POST" })
}
