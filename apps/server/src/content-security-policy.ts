import type { secureHeaders } from "hono/secure-headers"

type ContentSecurityPolicyOptions = NonNullable<
  NonNullable<Parameters<typeof secureHeaders>[0]>["contentSecurityPolicy"]
>

const BROWSER_API_ORIGINS = ["https://api.anthropic.com", "https://api.github.com"]
const OCR_LANGUAGE_DATA_ORIGIN = "https://cdn.jsdelivr.net"

export function contentSecurityPolicy(extraConnectSources: string[] = []): ContentSecurityPolicyOptions {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
    workerSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'", ...BROWSER_API_ORIGINS, OCR_LANGUAGE_DATA_ORIGIN, ...extraConnectSources],
    manifestSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  }
}
