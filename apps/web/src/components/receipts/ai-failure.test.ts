import { describe, expect, test } from "bun:test"
import { AiExtractionError } from "@/lib/receipts/ai-extract"
import { aiFailureKind, aiFailureReasonKey } from "./ai-failure"

function extractionError(kind: AiExtractionError["kind"]): AiExtractionError {
  return Object.assign(Object.create(AiExtractionError.prototype), { kind, message: kind })
}

describe("échec de l'analyse par l'IA", () => {
  test("ignore une analyse annulée", () => {
    expect(aiFailureKind(extractionError("aborted"))).toBeNull()
  })

  test("garde le type d'erreur de l'IA", () => {
    expect(aiFailureKind(extractionError("rate-limit"))).toBe("rate-limit")
  })

  test("traite une erreur inconnue comme une réponse invalide", () => {
    expect(aiFailureKind(new Error("boom"))).toBe("invalid")
  })

  test("donne une raison traduisible", () => {
    expect(aiFailureReasonKey("rate-limit")).toBe("receipts.ai.errors.rateLimit")
  })
})
