import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { usePageTitle } from "@/hooks/use-page-title"
import { api } from "@/lib/api"
import { authQuery } from "@/lib/queries"

const loginSchema = z.object({
  password: z.string().min(1, "Saisissez le mot de passe"),
})

type LoginValues = z.infer<typeof loginSchema>

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    const { authenticated } = await context.queryClient.ensureQueryData(authQuery)
    if (authenticated) throw redirect({ to: "/" })
  },
  component: LoginPage,
})

function LoginPage() {
  usePageTitle("Connexion")
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { password: "" },
  })

  const login = useMutation({
    mutationFn: (values: LoginValues) => api.auth.login(values.password),
    onSuccess: async (result) => {
      queryClient.setQueryData(authQuery.queryKey, result)
      await navigate({ to: "/" })
    },
    onError: (error) => toast.error(error.message),
  })

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">centime</CardTitle>
          <CardDescription>Connectez-vous pour accéder à votre budget.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => login.mutate(values))} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mot de passe</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="current-password" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={login.isPending}>
                {login.isPending ? "Connexion…" : "Se connecter"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  )
}
