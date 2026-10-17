import { describe, expect, it } from "bun:test"
import { pickLeastUsedColor } from "./palette"

const PALETTE = ["#aa1111", "#bb2222", "#cc3333"]

describe("pickLeastUsedColor", () => {
  it("rejects an empty palette", () => {
    expect(() => pickLeastUsedColor([], ["#aa1111"])).toThrow()
  })

  it("takes the first palette color when nothing is used", () => {
    expect(pickLeastUsedColor(PALETTE, [])).toBe("#aa1111")
  })

  it("takes the first palette color among the least used ones", () => {
    expect(pickLeastUsedColor(PALETTE, ["#aa1111", "#cc3333"])).toBe("#bb2222")
    expect(pickLeastUsedColor(PALETTE, ["#aa1111", "#bb2222", "#cc3333", "#bb2222"])).toBe("#aa1111")
  })

  it("ignores colors outside the palette", () => {
    expect(pickLeastUsedColor(PALETTE, ["#abcdef", "#abcdef", "#aa1111"])).toBe("#bb2222")
  })

  it("compares colors without case sensitivity", () => {
    expect(pickLeastUsedColor(PALETTE, ["#AA1111"])).toBe("#bb2222")
  })
})
