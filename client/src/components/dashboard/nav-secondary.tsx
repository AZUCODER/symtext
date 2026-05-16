"use client"

import * as React from "react"
import Link from "next/link"
import { type LucideIcon } from "lucide-react"
import { ChevronRightIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { CloudIcon, BrainCircuitIcon } from "lucide-react"

const settingsMenuItems = [
  { label: "Website", url: "#" },
  { label: "Billing Configuration", url: "/dashboard/billing-configuration" },
  { label: "Finance Transactions", url: "/dashboard/finance-transactions" },
  { label: "Configuration", url: "#" },
  { label: "Cloud OSS Configuration", url: "/dashboard/cloud-oss-configuration", icon: CloudIcon },
  { label: "AI LLM Configuration", url: "/dashboard/ai-llm-configuration", icon: BrainCircuitIcon },
]

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)

  return (
    <SidebarGroup {...props}>
      <SidebarGroupLabel>System</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) =>
            item.title === "Settings" ? (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  onClick={() => setIsSettingsOpen((open) => !open)}
                  aria-expanded={isSettingsOpen}
                  aria-label="Toggle settings menu"
                >
                  <item.icon />
                  <span>{item.title}</span>
                  <ChevronRightIcon
                    className={`ml-auto transition-transform ${isSettingsOpen ? "rotate-90" : ""}`}
                  />
                </SidebarMenuButton>
                {isSettingsOpen ? (
                  <SidebarMenuSub>
                    {settingsMenuItems.map((setting) => (
                      <SidebarMenuSubItem key={setting.label}>
                        <SidebarMenuSubButton 
                          render={setting.url === "#" ? <a href="#" /> : <Link href={setting.url} />}
                        >
                          {setting.icon && <setting.icon />}
                          <span>{setting.label}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton render={item.url === "#" ? <a href="#" /> : <Link href={item.url} />}>
                  <item.icon />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
