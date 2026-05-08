"use client"

import * as React from "react"
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

const settingsMenuItems = ["Website", "Billing", "Configuration"]

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
                      <SidebarMenuSubItem key={setting}>
                        <SidebarMenuSubButton render={<a href="#" />}>
                          <span>{setting}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                ) : null}
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton render={<a href={item.url} />}>
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
