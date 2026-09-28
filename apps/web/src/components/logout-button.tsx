import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { LogOut } from "lucide-react"
import { toast } from "sonner"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { api } from "@/lib/api"

export function LogoutButton() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const logout = useMutation({
    mutationFn: api.auth.logout,
    onSuccess: async () => {
      queryClient.clear()
      await navigate({ to: "/login" })
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <SidebarMenuButton tooltip="Déconnexion" onClick={() => logout.mutate()} disabled={logout.isPending}>
      <LogOut />
      <span>Déconnexion</span>
    </SidebarMenuButton>
  )
}
