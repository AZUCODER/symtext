import { Check } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { PricingPlan } from "@/lib/api"
import { cn } from "@/lib/utils"

type PricingProps = {
  plans: PricingPlan[]
}

export default function Pricing({ plans }: PricingProps) {
  return (
    <section aria-labelledby="pricing-title" className="w-full py-4 sm:py-8">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold tracking-[0.12em] text-neutral-500 uppercase">Pricing</p>
        <h1 id="pricing-title" className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Choose The Right Plan
        </h1>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Start with Free, scale with Pro, and unlock tailored controls with Enterprise.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {plans.map((plan) => {
          const isPro = plan.code === "pro"
          return (
            <article
              key={plan.code}
              className={cn(
                "relative flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm",
                isPro && "border-black/80 shadow-lg dark:border-white/80",
              )}
            >
              {isPro && (
                <Badge className="absolute top-4 right-4" variant="default">
                  Most Popular
                </Badge>
              )}

              <h2 className="text-2xl font-semibold">{plan.name}</h2>
              <p className="mt-4 text-4xl font-semibold tracking-tight">
                ${plan.price_monthly_usd}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
              </p>
              <p className="mt-4 min-h-12 text-sm text-muted-foreground">{plan.description}</p>

              <Button className="mt-6 w-full" size="lg" variant={isPro ? "default" : "outline"}>
                {plan.cta_label}
              </Button>

              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>
    </section>
  )
}
