"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ChevronRightIcon, FolderIcon } from "lucide-react"

const MODULE_HUB_OPEN_STORAGE_KEY = "symtext.moduleHubOpen"
const MODULE_HUB_SELECTED_STORAGE_KEY = "symtext.moduleHubSelected"

export function NavApplications({
  items,
}: {
  items: {
    name: string
    url: string
    icon: React.ReactNode
  }[]
}) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(() => {
    if (typeof window === "undefined") return true

    try {
      const storedOpen = window.localStorage.getItem(MODULE_HUB_OPEN_STORAGE_KEY)
      return storedOpen === null ? true : storedOpen === "true"
    } catch {
      // Ignore localStorage failures (private mode or restricted environments).
      return true
    }
  })
  const [selectedItem, setSelectedItem] = React.useState<string | null>(() => {
    const defaultItem = items[0]?.name ?? null
    if (typeof window === "undefined") return defaultItem

    try {
      return window.localStorage.getItem(MODULE_HUB_SELECTED_STORAGE_KEY) ?? defaultItem
    } catch {
      // Ignore localStorage failures (private mode or restricted environments).
      return defaultItem
    }
  })

  React.useEffect(() => {
    try {
      window.localStorage.setItem(MODULE_HUB_OPEN_STORAGE_KEY, String(isOpen))
    } catch {
      // Ignore localStorage failures (private mode or restricted environments).
    }
  }, [isOpen])

  React.useEffect(() => {
    if (!selectedItem) return

    try {
      window.localStorage.setItem(MODULE_HUB_SELECTED_STORAGE_KEY, selectedItem)
    } catch {
      // Ignore localStorage failures (private mode or restricted environments).
    }
  }, [selectedItem])

  const isItemActive = React.useCallback(
    (item: { name: string; url: string }) => {
      const hasRoute = item.url && item.url !== "#"
      if (hasRoute) {
        return pathname === item.url || pathname.startsWith(`${item.url}/`)
      }

      return selectedItem === item.name
    },
    [pathname, selectedItem]
  )

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setIsOpen((open) => !open)}
            aria-expanded={isOpen}
            aria-label="Toggle applications modules"
          >
            <FolderIcon />
            <span>Module Hub</span>
            <ChevronRightIcon
              className={`ml-auto transition-transform ${isOpen ? "rotate-90" : ""}`}
            />
          </SidebarMenuButton>
          {isOpen ? (
            <SidebarMenuSub>
              {items.map((item) => (
                <SidebarMenuSubItem key={item.name}>
                  <SidebarMenuSubButton
                    render={item.url === "#" ? <a href="#" /> : <Link href={item.url} />}
                    isActive={isItemActive(item)}
                    onClick={() => setSelectedItem(item.name)}
                    aria-current={isItemActive(item) ? "page" : undefined}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          ) : null}
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}
