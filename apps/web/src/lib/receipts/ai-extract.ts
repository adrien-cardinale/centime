import {
  buildReceiptAiInstruction,
  type ReceiptAiCategory,
  type ReceiptAiLine,
  type ReceiptAiOutput,
  type ReceiptAiResult,
  receiptAiOutputSchema,
  toAiExtractionResult,
} from "@centime/core"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { format } from "date-fns"
import { isTauri } from "@/lib/runtime"
import type { AiExtractionSettings } from "./ai-settings"

type AnthropicModule = typeof import("@anthropic-ai/sdk")
type AnthropicClient = InstanceType<AnthropicModule["default"]>

export type AiExtractionCategory = ReceiptAiCategory
export type AiExtractionLine = ReceiptAiLine
export type AiExtractionResult = ReceiptAiResult

export type AiExtractionErrorKind = "auth" | "rate-limit" | "network" | "refused" | "invalid" | "aborted" | "unsupported"

export type AiExtractionInput = {
  bytes: Uint8Array
  mime: string
  categories: AiExtractionCategory[]
  settings: AiExtractionSettings
  signal?: AbortSignal
}

type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif"

const SUPPORTED_IMAGE_MIMES: ReadonlySet<string> = new Set<SupportedImageMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
])
const MODELS_WITH_SERVER_FALLBACK: ReadonlySet<string> = new Set(["claude-opus-5-5", "claude-sonnet-5-5"])
const SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01"
const MAX_OUTPUT_TOKENS = 4096
const REQUEST_TIMEOUT_MS = 90_000
const BASE64_CHUNK_SIZE = 0x8000

export class AiExtractionError extends Error {
  readonly kind: AiExtractionErrorKind

  constructor(kind: AiExtractionErrorKind, options?: { cause?: unknown }) {
    super(`AI receipt extraction failed: ${kind}`, options)
    this.name = "AiExtractionError"
    this.kind = kind
  }
}

export function isAiExtractionSupported(mime: string): mime is SupportedImageMime {
  return SUPPORTED_IMAGE_MIMES.has(mime)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK_SIZE))
  }
  return btoa(binary)
}

function createClient(sdk: AnthropicModule, apiKey: string): AnthropicClient {
  return new sdk.default({
    apiKey,
    dangerouslyAllowBrowser: true,
    timeout: REQUEST_TIMEOUT_MS,
    fetch: isTauri() ? tauriFetch : undefined,
  })
}

function serverFallbackOptions(model: string) {
  if (!MODELS_WITH_SERVER_FALLBACK.has(model)) return {}
  return { betas: [SERVER_FALLBACK_BETA], fallbacks: "default" as const }
}

async function requestExtraction(sdk: AnthropicModule, input: AiExtractionInput, mime: SupportedImageMime) {
  const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod")
  const outputFormat = betaZodOutputFormat(receiptAiOutputSchema)
  const model = input.settings.model.trim()
  const client = createClient(sdk, input.settings.apiKey.trim())
  const response = await client.beta.messages.create(
    {
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      ...serverFallbackOptions(model),
      output_config: { effort: "low", format: outputFormat },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mime, data: toBase64(input.bytes) } },
            { type: "text", text: buildReceiptAiInstruction(input.categories, format(new Date(), "yyyy-MM-dd")) },
          ],
        },
      ],
    },
    { signal: input.signal },
  )
  return { response, outputFormat }
}

function readOutput({ response, outputFormat }: Awaited<ReturnType<typeof requestExtraction>>): ReceiptAiOutput {
  if (response.stop_reason === "refusal") throw new AiExtractionError("refused")
  if (response.stop_reason === "max_tokens") throw new AiExtractionError("invalid")
  const textBlock = response.content.find((block) => block.type === "text")
  if (!textBlock) throw new AiExtractionError("invalid")
  return outputFormat.parse(textBlock.text)
}

function toExtractionError(sdk: AnthropicModule, error: unknown, signal: AbortSignal | undefined): AiExtractionError {
  if (error instanceof AiExtractionError) return error
  const cause = { cause: error }
  if (signal?.aborted || error instanceof sdk.APIUserAbortError) return new AiExtractionError("aborted", cause)
  if (error instanceof sdk.AuthenticationError) return new AiExtractionError("auth", cause)
  if (error instanceof sdk.PermissionDeniedError) return new AiExtractionError("auth", cause)
  if (error instanceof sdk.RateLimitError) return new AiExtractionError("rate-limit", cause)
  if (error instanceof sdk.APIConnectionError) return new AiExtractionError("network", cause)
  if (error instanceof sdk.InternalServerError) return new AiExtractionError("network", cause)
  return new AiExtractionError("invalid", cause)
}

function abortedError(): AiExtractionError {
  return new AiExtractionError("aborted")
}

export async function extractReceiptWithAi(input: AiExtractionInput): Promise<AiExtractionResult> {
  const mime = input.mime.toLowerCase()
  if (!isAiExtractionSupported(mime)) throw new AiExtractionError("unsupported")
  if (input.signal?.aborted) throw abortedError()
  const sdk = await import("@anthropic-ai/sdk")
  if (input.signal?.aborted) throw abortedError()
  try {
    const output = readOutput(await requestExtraction(sdk, input, mime))
    return toAiExtractionResult(output, input.categories)
  } catch (error) {
    throw toExtractionError(sdk, error, input.signal)
  }
}
