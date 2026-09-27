import { normalizeLabel } from "./fingerprint"
import type { Rule, RuleField } from "./types"

export type RuleInput = Pick<
  Rule,
  "id" | "pattern" | "matchKind" | "field" | "categoryId" | "fixedItemId" | "markAsTransfer" | "priority"
> & { createdAt?: string }

export type RuleSubject = {
  rawLabel: string
  merchant: string | null
  providerCategory: string | null
}

export type RuleOutcome = {
  ruleId: string
  categoryId: string | null
  fixedItemId: string | null
  markAsTransfer: boolean
}

export type CompiledRule = {
  rule: RuleInput
  test: (value: string) => boolean
}

export type InvalidRule = {
  rule: RuleInput
  message: string
}

export type CompiledRules = {
  compiled: CompiledRule[]
  invalid: InvalidRule[]
}

export type RulePatternSuggestion = {
  field: RuleField
  pattern: string
}

type Matcher = { ok: true; test: (value: string) => boolean } | { ok: false; message: string }

export function regexError(pattern: string): string | null {
  try {
    new RegExp(pattern, "iu")
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function containsMatcher(pattern: string): Matcher {
  const needle = normalizeLabel(pattern)
  if (needle === "") return { ok: false, message: "Motif vide" }
  return { ok: true, test: (value) => normalizeLabel(value).includes(needle) }
}

function regexMatcher(pattern: string): Matcher {
  if (pattern === "") return { ok: false, message: "Motif vide" }
  const error = regexError(pattern)
  if (error !== null) return { ok: false, message: error }
  const regex = new RegExp(pattern, "iu")
  return { ok: true, test: (value) => regex.test(value) }
}

function buildMatcher(rule: RuleInput): Matcher {
  return rule.matchKind === "regex" ? regexMatcher(rule.pattern) : containsMatcher(rule.pattern)
}

function fieldValue(field: RuleField, subject: RuleSubject): string | null {
  switch (field) {
    case "raw_label":
      return subject.rawLabel
    case "merchant":
      return subject.merchant
    case "provider_category":
      return subject.providerCategory
  }
}

function byPriorityThenAge(left: RuleInput, right: RuleInput): number {
  if (left.priority !== right.priority) return right.priority - left.priority
  if (left.createdAt === undefined || right.createdAt === undefined) return 0
  return left.createdAt.localeCompare(right.createdAt)
}

export function compileRules(rules: RuleInput[]): CompiledRules {
  const compiled: CompiledRule[] = []
  const invalid: InvalidRule[] = []
  for (const rule of [...rules].sort(byPriorityThenAge)) {
    const matcher = buildMatcher(rule)
    if (matcher.ok) compiled.push({ rule, test: matcher.test })
    else invalid.push({ rule, message: matcher.message })
  }
  return { compiled, invalid }
}

function compiledMatches(compiled: CompiledRule, subject: RuleSubject): boolean {
  const value = fieldValue(compiled.rule.field, subject)
  return value !== null && compiled.test(value)
}

export function ruleMatches(rule: RuleInput, subject: RuleSubject): boolean {
  const [compiled] = compileRules([rule]).compiled
  return compiled !== undefined && compiledMatches(compiled, subject)
}

function toOutcome(rule: RuleInput): RuleOutcome {
  return {
    ruleId: rule.id,
    categoryId: rule.categoryId,
    fixedItemId: rule.fixedItemId,
    markAsTransfer: rule.markAsTransfer,
  }
}

export function applyCompiledRules(compiled: CompiledRule[], subject: RuleSubject): RuleOutcome | null {
  const winner = compiled.find((candidate) => compiledMatches(candidate, subject))
  return winner ? toOutcome(winner.rule) : null
}

export function applyRules(rules: RuleInput[], subject: RuleSubject): RuleOutcome | null {
  return applyCompiledRules(compileRules(rules).compiled, subject)
}

const LABEL_NOISE_PATTERNS = [/\bNo\.? carte\b/iu, /\bNo\.? TWINT\b/iu, /\d/u]

const GENERIC_WORDS = new Set([
  "a",
  "achat",
  "au",
  "credit",
  "de",
  "debit",
  "depuis",
  "du",
  "e-banking",
  "l",
  "la",
  "le",
  "les",
  "ordre",
  "paiement",
  "retrait",
  "sur",
  "transfert",
  "twint",
])

const TRAILING_SEPARATORS = /[\s,.;:/-]+$/u
const WORD_SEPARATORS = /[\s']+/u

function cutBeforeNoise(label: string): string {
  const cut = LABEL_NOISE_PATTERNS.reduce((earliest, pattern) => {
    const index = label.search(pattern)
    return index === -1 ? earliest : Math.min(earliest, index)
  }, label.length)
  return label.slice(0, cut)
}

function isSignificant(segment: string): boolean {
  return normalizeLabel(segment)
    .split(WORD_SEPARATORS)
    .some((word) => word.length > 1 && !GENERIC_WORDS.has(word))
}

function firstSignificantPrefix(label: string): string {
  let end = 0
  for (const segment of label.split(",")) {
    end += segment.length
    if (isSignificant(segment)) return label.slice(0, end)
    end += 1
  }
  return label
}

export function suggestRulePattern(subject: RuleSubject): RulePatternSuggestion {
  const merchant = subject.merchant?.trim()
  if (merchant) return { field: "merchant", pattern: merchant }
  const prefix = firstSignificantPrefix(cutBeforeNoise(subject.rawLabel)).replace(TRAILING_SEPARATORS, "").trim()
  return { field: "raw_label", pattern: prefix === "" ? subject.rawLabel.trim() : prefix }
}
