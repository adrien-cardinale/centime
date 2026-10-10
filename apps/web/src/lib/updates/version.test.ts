import { describe, expect, test } from "bun:test"
import { isNewerVersion, parseVersion, stripVersionPrefix } from "./version"

describe("comparaison de versions", () => {
  test("accepte le tag avec ou sans préfixe v", () => {
    expect(parseVersion("v1.2.3")).toEqual({ release: [1, 2, 3], prerelease: [] })
    expect(stripVersionPrefix(" v1.2.3 ")).toBe("1.2.3")
  })

  test("rejette ce qui n'est pas une version", () => {
    expect(parseVersion("latest")).toBeNull()
    expect(parseVersion("1.2")).toBeNull()
    expect(isNewerVersion("latest", "1.0.0")).toBe(false)
  })

  test("ordonne majeur, mineur et correctif", () => {
    expect(isNewerVersion("0.2.0", "0.1.9")).toBe(true)
    expect(isNewerVersion("1.0.0", "0.9.9")).toBe(true)
    expect(isNewerVersion("0.1.1", "0.1.1")).toBe(false)
    expect(isNewerVersion("0.1.0", "0.1.1")).toBe(false)
    expect(isNewerVersion("v0.10.0", "0.9.0")).toBe(true)
  })

  test("place une préversion avant la version finale", () => {
    expect(isNewerVersion("0.2.0", "0.2.0-rc.1")).toBe(true)
    expect(isNewerVersion("0.2.0-rc.1", "0.2.0")).toBe(false)
    expect(isNewerVersion("0.2.0-rc.2", "0.2.0-rc.1")).toBe(true)
    expect(isNewerVersion("0.2.0-beta", "0.2.0-alpha")).toBe(true)
    expect(isNewerVersion("0.2.0-rc.1", "0.1.9")).toBe(true)
  })
})
