export type CategoryTreeNode = { id: string; parentId: string | null }

function childrenByParent(nodes: readonly CategoryTreeNode[]): Map<string, string[]> {
  const children = new Map<string, string[]>()
  for (const node of nodes) {
    if (node.parentId === null) continue
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id])
  }
  return children
}

export function categoryWithDescendants(nodes: readonly CategoryTreeNode[], rootId: string): string[] {
  const children = childrenByParent(nodes)
  const collected = new Set<string>()
  const pending = [rootId]
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    if (collected.has(current)) continue
    collected.add(current)
    pending.push(...(children.get(current) ?? []))
  }
  return [...collected]
}

function rootOf(id: string, parents: Map<string, string | null>): string {
  const visited = new Set<string>()
  let current = id
  for (let parent = parents.get(current); parent && !visited.has(parent); parent = parents.get(current)) {
    visited.add(current)
    current = parent
  }
  return current
}

export function categoryRoots(nodes: readonly CategoryTreeNode[]): Map<string, string> {
  const parents = new Map(nodes.map((node) => [node.id, node.parentId]))
  return new Map(nodes.map((node) => [node.id, rootOf(node.id, parents)]))
}
