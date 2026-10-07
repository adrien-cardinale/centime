import { useCallback, useEffect, useState, type ReactNode } from "react"
import i18n from "@/i18n"
import { KeyRequiredError } from "@/lib/crypto/onboarding"
import { Onboarding } from "./onboarding"
import { StartupFailure, StartupLoading } from "./startup-screen"

type BootState = { kind: "loading" } | { kind: "onboarding" } | { kind: "ready" } | { kind: "failed"; message: string }

type AppBootProps = {
  boot: () => Promise<void>
  children: ReactNode
}

function failureMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === "string" ? error : i18n.t("errors.unexpected")
}

export function AppBoot({ boot, children }: AppBootProps) {
  const [state, setState] = useState<BootState>({ kind: "loading" })

  const start = useCallback(() => {
    setState({ kind: "loading" })
    boot().then(
      () => setState({ kind: "ready" }),
      (error: unknown) =>
        setState(error instanceof KeyRequiredError ? { kind: "onboarding" } : { kind: "failed", message: failureMessage(error) }),
    )
  }, [boot])

  useEffect(start, [start])

  if (state.kind === "ready") return children
  if (state.kind === "onboarding") return <Onboarding onDone={start} />
  if (state.kind === "failed") return <StartupFailure message={state.message} onRetry={start} />
  return <StartupLoading />
}
