interface CentimeSubtleCrypto {
  digest(algorithm: "SHA-256", data: Uint8Array): Promise<ArrayBuffer>
}

interface CentimeCrypto {
  randomUUID(): string
  getRandomValues<Values extends Uint8Array>(values: Values): Values
  readonly subtle: CentimeSubtleCrypto
}

declare var crypto: CentimeCrypto

declare class TextEncoder {
  encode(input?: string): Uint8Array
}

interface TextDecoderOptions {
  fatal?: boolean
  ignoreBOM?: boolean
}

declare class TextDecoder {
  constructor(label?: string, options?: TextDecoderOptions)
  readonly encoding: string
  decode(input?: Uint8Array): string
}
