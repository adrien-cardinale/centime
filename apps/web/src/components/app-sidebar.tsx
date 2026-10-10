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
  useSidebar,
} from "@/components/ui/sidebar"
import { navigationItems, settingsItem } from "./navigation"
import SyncIndicator from "./sync/sync-indicator"
import { ThemeToggle } from "./theme-toggle"

export function AppSidebar() {
  const matchRoute = useMatchRoute()
  const { t } = useTranslation()
  const { isMobile, setOpenMobile } = useSidebar()
  const closeMobileSidebar = () => setOpenMobile(false)
  // Sur mobile, la sidebar occupe une entrée d'historique : la navigation la remplace pour que « retour » ramène à la page précédente.
  const replaceOverlayEntry = isMobile
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
                      <Link
                        to={item.to}
                        replace={replaceOverlayEntry}
                        onClick={closeMobileSidebar}
                        aria-current={isActive ? "page" : undefined}
                      >
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
            <SidebarMenuButton
              asChild
              isActive={Boolean(matchRoute({ to: settingsItem.to, fuzzy: true }))}
              tooltip={t(settingsItem.titleKey)}
            >
              <Link to={settingsItem.to} replace={replaceOverlayEntry} onClick={closeMobileSidebar}>
                <settingsItem.icon />
                <span>{t(settingsItem.titleKey)}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
