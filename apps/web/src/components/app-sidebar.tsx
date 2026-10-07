import { Link, useMatchRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
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
import { navigationItems } from "./navigation"
import SyncIndicator from "./sync/sync-indicator"
import { ThemeToggle } from "./theme-toggle"

export function AppSidebar() {
  const matchRoute = useMatchRoute()
  const { t } = useTranslation()
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
                    <SidebarMenuButton asChild isActive={isActive} tooltip={t(item.titleKey)}>
                      <Link to={item.to} aria-current={isActive ? "page" : undefined}>
                        <item.icon />
                        <span>{t(item.titleKey)}</span>
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
            <SyncIndicator />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
