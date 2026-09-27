import { stripByteOrderMark } from "./csv-tokenizer"

export function decodeBytes(bytes: Uint8Array, encoding: string): string {
  return stripByteOrderMark(new TextDecoder(encoding).decode(bytes))
}
