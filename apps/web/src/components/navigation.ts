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
  title: string
  to: "/" | "/accounts" | "/transactions" | "/import" | "/budgets" | "/categories" | "/settings"
  icon: LucideIcon
}

export const navigationItems: NavigationItem[] = [
  { title: "Tableau de bord", to: "/", icon: LayoutDashboard },
  { title: "Transactions", to: "/transactions", icon: ArrowLeftRight },
  { title: "Import", to: "/import", icon: Upload },
  { title: "Budget", to: "/budgets", icon: PiggyBank },
  { title: "Catégories", to: "/categories", icon: FolderTree },
  { title: "Comptes", to: "/accounts", icon: Wallet },
  { title: "Paramètres", to: "/settings", icon: Settings },
]
