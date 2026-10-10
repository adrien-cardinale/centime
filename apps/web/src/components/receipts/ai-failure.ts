import { AiExtractionError, type AiExtractionErrorKind } from "@/lib/receipts/ai-extract"

export type AiFailureKind = Exclude<AiExtractionErrorKind, "aborted">

const REASON_KEYS: Record<AiFailureKind, string> = {
  auth: "receipts.ai.errors.auth",
  "rate-limit": "receipts.ai.errors.rateLimit",
  network: "receipts.ai.errors.network",
  refused: "receipts.ai.errors.refused",
  invalid: "receipts.ai.errors.invalid",
  unsupported: "receipts.ai.errors.unsupported",
}

export function aiFailureKind(error: unknown): AiFailureKind | null {
  if (!(error instanceof AiExtractionError)) return "invalid"
  return error.kind === "aborted" ? null : error.kind
}

export function aiFailureReasonKey(kind: AiFailureKind): string {
  return REASON_KEYS[kind]
}
