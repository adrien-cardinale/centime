import { Link, useMatchRoute } from "@tanstack/react-router"
import { lazy, Suspense } from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { isDesktop } from "@/lib/runtime"
import { LogoutButton } from "./logout-button"
import { navigationItems } from "./navigation"
import { ThemeToggle } from "./theme-toggle"

const SyncIndicator = __CENTIME_DESKTOP__ ? lazy(() => import("./sync/sync-indicator")) : null

function SessionMenuItem() {
  if (isDesktop && SyncIndicator) {
    return (
      <Suspense fallback={null}>
        <SyncIndicator />
      </Suspense>
    )
  }
  return <LogoutButton />
}

export function AppSidebar() {
  const matchRoute = useMatchRoute()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex h-8 items-center px-2 text-base font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
          centime
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = Boolean(matchRoute({ to: item.to, fuzzy: item.to !== "/" }))
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link to={item.to} aria-current={isActive ? "page" : undefined}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SessionMenuItem />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
