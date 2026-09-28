import { useCallback, useEffect, useState, type ReactNode } from "react"
import { isDesktop } from "@/lib/runtime"
import { StartupFailure, StartupLoading } from "./startup-screen"

type BootState = { kind: "loading" } | { kind: "ready" } | { kind: "failed"; message: string }

type AppBootProps = {
  boot: () => Promise<void>
  children: ReactNode
}

function failureMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : "Erreur inattendue"
}

export function AppBoot({ boot, children }: AppBootProps) {
  const [state, setState] = useState<BootState>({ kind: "loading" })

  const start = useCallback(() => {
    setState({ kind: "loading" })
    boot().then(
      () => setState({ kind: "ready" }),
      (error: unknown) => setState({ kind: "failed", message: failureMessage(error) }),
    )
  }, [boot])

  useEffect(start, [start])

  if (state.kind === "ready") return children
  if (state.kind === "failed") return <StartupFailure message={state.message} onRetry={start} />
  return isDesktop ? <StartupLoading /> : null
}
