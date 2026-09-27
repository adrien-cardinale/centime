export function encodeLatin1(text: string): Uint8Array {
  return Uint8Array.from(text, (char) => {
    const code = char.charCodeAt(0)
    if (code > 0xff) throw new RangeError(`Caractère hors ISO-8859-1 : ${char}`)
    return code
  })
}

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}
