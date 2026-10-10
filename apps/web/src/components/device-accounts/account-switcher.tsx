import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Check, ChevronsUpDown, Settings2, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"
import { activeAccount } from "@/lib/account/account-index"
import { deviceAccountsQuery } from "@/lib/account/accounts-query"
import { switchToAccount } from "./switch-to-account"

type AccountSwitcherProps = {
  replace: boolean
  onNavigate: () => void
}

export function AccountSwitcher({ replace, onNavigate }: AccountSwitcherProps) {
  const { t } = useTranslation()
  const { data: index } = useQuery(deviceAccountsQuery)
  if (!index || index.accounts.length < 2) return null
  const label = activeAccount(index)?.label ?? ""

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton tooltip={label}>
            <UserRound />
            <span className="truncate">{label}</span>
            <ChevronsUpDown className="ml-auto" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="min-w-56">
          <DropdownMenuLabel>{t("settings.account.title")}</DropdownMenuLabel>
          {index.accounts.map((account) => {
            const isActive = account.id === index.activeId
            return (
              <DropdownMenuItem
                key={account.id}
                onSelect={() => {
                  if (!isActive) void switchToAccount(account.id)
                }}
              >
                <Check className={isActive ? undefined : "invisible"} />
                <span className="truncate">{account.label}</span>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings" replace={replace} onClick={onNavigate}>
              <Settings2 />
              {t("settings.account.manage")}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
