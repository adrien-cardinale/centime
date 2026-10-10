const VERSION_PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/

export type ParsedVersion = { release: [number, number, number]; prerelease: string[] }

export function stripVersionPrefix(value: string): string {
  return value.trim().replace(/^v/, "")
}

export function parseVersion(value: string): ParsedVersion | null {
  const match = VERSION_PATTERN.exec(value.trim())
  if (!match) return null
  const [, major, minor, patch, prerelease] = match
  return {
    release: [Number(major), Number(minor), Number(patch)],
    prerelease: prerelease ? prerelease.split(".") : [],
  }
}

function compareIdentifiers(left: string, right: string): number {
  const leftIsNumber = /^\d+$/.test(left)
  const rightIsNumber = /^\d+$/.test(right)
  if (leftIsNumber && rightIsNumber) return Math.sign(Number(left) - Number(right))
  if (leftIsNumber) return -1
  if (rightIsNumber) return 1
  if (left === right) return 0
  return left < right ? -1 : 1
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const leftIdentifier = left[index]
    const rightIdentifier = right[index]
    if (leftIdentifier === undefined) return -1
    if (rightIdentifier === undefined) return 1
    const difference = compareIdentifiers(leftIdentifier, rightIdentifier)
    if (difference !== 0) return difference
  }
  return 0
}

export function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (let index = 0; index < left.release.length; index += 1) {
    const difference = Math.sign((left.release[index] ?? 0) - (right.release[index] ?? 0))
    if (difference !== 0) return difference
  }
  return comparePrerelease(left.prerelease, right.prerelease)
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const parsedCandidate = parseVersion(candidate)
  const parsedCurrent = parseVersion(current)
  if (!parsedCandidate || !parsedCurrent) return false
  return compareVersions(parsedCandidate, parsedCurrent) > 0
}
