import {
  ArrowLeftRight,
  FolderTree,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Settings,
  Upload,
  Wallet,
} from "lucide-react"

export type NavigationItem = {
  titleKey: string
  to: "/" | "/accounts" | "/transactions" | "/import" | "/budgets" | "/categories" | "/settings"
  icon: LucideIcon
}

export const navigationItems: NavigationItem[] = [
  { titleKey: "nav.dashboard", to: "/", icon: LayoutDashboard },
  { titleKey: "nav.transactions", to: "/transactions", icon: ArrowLeftRight },
  { titleKey: "nav.import", to: "/import", icon: Upload },
  { titleKey: "nav.budget", to: "/budgets", icon: PiggyBank },
  { titleKey: "nav.categories", to: "/categories", icon: FolderTree },
  { titleKey: "nav.accounts", to: "/accounts", icon: Wallet },
]

export const settingsItem: NavigationItem = {
  titleKey: "nav.settings",
  to: "/settings",
  icon: Settings,
}
