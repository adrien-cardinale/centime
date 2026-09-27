interface TextDecoderOptions {
  fatal?: boolean
  ignoreBOM?: boolean
}

declare class TextDecoder {
  constructor(label?: string, options?: TextDecoderOptions)
  readonly encoding: string
  decode(input?: Uint8Array): string
}

declare class TextEncoder {
  encode(input?: string): Uint8Array
}
