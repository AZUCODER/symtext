"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { type LucideIcon } from "lucide-react"
import { BotIcon, CirclePlusIcon, FileTextIcon, MailIcon, WrenchIcon } from "lucide-react"

const createItems: { label: string; url: string; icon: LucideIcon }[] = [
  {
    label: "Blog Post",
    url: "/dashboard/blog/new",
    icon: FileTextIcon,
  },
  {
    label: "Agent Task",
    url: "/dashboard/agent-tools",
    icon: BotIcon,
  },
  {
    label: "Skills",
    url: "/dashboard/ai-llm-configuration",
    icon: WrenchIcon,
  },
]

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
}) {
  const { isMobile } = useSidebar()
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    tooltip="Create"
                    className="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
                  />
                }
              >
                <CirclePlusIcon
                />
                <span>Create</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-52"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                {createItems.map((item) => (
                  <DropdownMenuItem key={item.label} render={<Link href={item.url} />}>
                    <item.icon />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <MailIcon
              />
              <span className="sr-only">Notifications</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={item.url !== "#" && (pathname === item.url || pathname.startsWith(`${item.url}/`))}
                render={item.url === "#" ? <a href="#" /> : <Link href={item.url} />}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
