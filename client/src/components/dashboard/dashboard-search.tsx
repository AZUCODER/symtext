"use client"

import * as React from "react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type LucideIcon } from "lucide-react"
import { SearchIcon, SparklesIcon } from "lucide-react"

const searchHistory = [
  "Monthly traffic report",
  "Agent onboarding workflow",
  "Homepage SEO settings",
]

const suggestedSearches = [
  "Create a new blog post",
  "Find inactive agents",
  "Billing usage this month",
]

const searchSections: {
  label: string
  icon: LucideIcon
  items: string[]
}[] = [
  {
    label: "Recent Searches",
    icon: SearchIcon,
    items: searchHistory,
  },
  {
    label: "Suggested",
    icon: SparklesIcon,
    items: suggestedSearches,
  },
]

export function DashboardSearch() {
  return (
    <div className="flex justify-center px-4 lg:px-6">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="flex h-10 w-full max-w-2xl items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground shadow-xs outline-hidden transition-colors hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Open search utility"
            />
          }
        >
          <SearchIcon className="size-4" />
          <span>Search content, agents, billing...</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[min(42rem,92vw)] rounded-xl p-2" align="center" sideOffset={8}>
          <div className="rounded-lg border border-border/60 bg-card p-2">
            <div className="mb-2 flex items-center gap-2 rounded-md border border-border/70 px-2 py-2 text-sm text-muted-foreground">
              <SearchIcon className="size-4" />
              <span>Type to search...</span>
            </div>

            {searchSections.map((section, index) => (
              <React.Fragment key={section.label}>
                {index > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2">{section.label}</DropdownMenuLabel>
                  {section.items.map((item) => (
                    <DropdownMenuItem key={item} render={<a href="#" />}>
                      <section.icon className="size-3.5" />
                      <span>{item}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </React.Fragment>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
