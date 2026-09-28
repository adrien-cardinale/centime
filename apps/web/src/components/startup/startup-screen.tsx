import { RotateCw, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export function StartupLoading() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm text-muted-foreground">Ouverture de la base locale…</p>
      <div className="w-full max-w-xs space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </main>
  )
}

type StartupFailureProps = {
  message: string
  onRetry: () => void
}

export function StartupFailure({ message, onRetry }: StartupFailureProps) {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Impossible d'ouvrir la base locale</AlertTitle>
          <AlertDescription className="break-words">{message}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={onRetry}>
          <RotateCw />
          Réessayer
        </Button>
      </div>
    </main>
  )
}
