"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react"

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="tracking-[0.02em]">Total Revenue</CardDescription>
          <CardTitle className="text-2xl font-semibold leading-tight tabular-nums @[250px]/card:text-3xl">
            $1,250.00
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon
              />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground/90">
            Trending up this month{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground/90">
            Visitors for the last 6 months
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="tracking-[0.02em]">New Customers</CardDescription>
          <CardTitle className="text-2xl font-semibold leading-tight tabular-nums @[250px]/card:text-3xl">
            1,234
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingDownIcon
              />
              -20%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground/90">
            Down 20% this period{" "}
            <TrendingDownIcon className="size-4" />
          </div>
          <div className="text-muted-foreground/90">
            Acquisition needs attention
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="tracking-[0.02em]">Active Accounts</CardDescription>
          <CardTitle className="text-2xl font-semibold leading-tight tabular-nums @[250px]/card:text-3xl">
            45,678
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon
              />
              +12.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground/90">
            Strong user retention{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground/90">Engagement exceed targets</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription className="tracking-[0.02em]">Growth Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold leading-tight tabular-nums @[250px]/card:text-3xl">
            4.5%
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon
              />
              +4.5%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="line-clamp-1 flex items-center gap-1.5 font-medium text-foreground/90">
            Steady performance increase{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground/90">Meets growth projections</div>
        </CardFooter>
      </Card>
    </div>
  )
}
