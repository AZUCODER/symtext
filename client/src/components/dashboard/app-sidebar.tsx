"use client"

import * as React from "react"
import Link from "next/link"

import { NavDocuments } from "@/components/dashboard/nav-documents"
import { NavMain } from "@/components/dashboard/nav-main"
import { NavSecondary } from "@/components/dashboard/nav-secondary"
import { NavUser } from "@/components/dashboard/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  LayoutDashboardIcon,
  BotIcon,
  ServerIcon,
  UsersIcon,
  Settings2Icon,
  CircleHelpIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FileIcon,
  FileTextIcon,
  CommandIcon,
} from "lucide-react"

const data = {
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: LayoutDashboardIcon,
    },
    {
      title: "Agent Tasks",
      url: "/dashboard/agent-tools",
      icon: BotIcon,
    },
    {
      title: "Blog Posts",
      url: "/dashboard/blog",
      icon: FileTextIcon,
    },
    {
      title: "Users",
      url: "/dashboard/users",
      icon: UsersIcon,
    },
    {
      title: "System Status",
      url: "/dashboard/system-status",
      icon: ServerIcon,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: Settings2Icon,
    },
    {
      title: "Help Center",
      url: "#",
      icon: CircleHelpIcon,
    },
  ],
  documents: [
    {
      name: "Knowledge Base",
      url: "#",
      icon: DatabaseIcon,
    },
    {
      name: "Reports",
      url: "#",
      icon: FileChartColumnIcon,
    },
    {
      name: "Templates",
      url: "#",
      icon: FileIcon,
    },
  ],
}
export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: {
    name: string
    email: string
    role?: "viewer" | "editor" | "admin"
    avatar?: string
  }
}) {
  const resolvedUser = user ?? {
    name: "Admin",
    email: "admin@symtext.com",
    role: "admin" as const,
    avatar: "/avatars/shadcn.jpg",
  }

  const navMainItems = data.navMain

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard" />}
            >
              <CommandIcon className="size-5!" />
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold leading-none">Symtext</span>
                <span className="text-[0.65rem] font-normal leading-none text-sidebar-foreground/70">
                  Agentic CMS for modern teams
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainItems} />
        <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: resolvedUser.name,
            email: resolvedUser.email,
            avatar: resolvedUser.avatar ?? "/avatars/shadcn.jpg",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
