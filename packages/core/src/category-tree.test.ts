import { describe, expect, it } from "vitest"
import { categoryRoots, categoryWithDescendants } from "./category-tree"

const nodes = [
  { id: "food", parentId: null },
  { id: "groceries", parentId: "food" },
  { id: "bakery", parentId: "groceries" },
  { id: "leisure", parentId: null },
]

describe("categoryWithDescendants", () => {
  it("collects descendants at every level", () => {
    expect(categoryWithDescendants(nodes, "food").sort()).toEqual(["bakery", "food", "groceries"])
    expect(categoryWithDescendants(nodes, "leisure")).toEqual(["leisure"])
  })

  it("survives a cycle", () => {
    const cyclic = [
      { id: "a", parentId: "b" },
      { id: "b", parentId: "a" },
    ]
    expect(categoryWithDescendants(cyclic, "a").sort()).toEqual(["a", "b"])
  })
})

describe("categoryRoots", () => {
  it("maps every category to its top-level ancestor", () => {
    const roots = categoryRoots(nodes)
    expect(roots.get("bakery")).toBe("food")
    expect(roots.get("food")).toBe("food")
    expect(roots.get("leisure")).toBe("leisure")
  })
})
