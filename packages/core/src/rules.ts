import { normalizeLabel } from "./fingerprint"
import type { Rule, RuleField } from "./types"

export type RuleInput = Pick<
  Rule,
  "id" | "pattern" | "matchKind" | "field" | "categoryId" | "markAsTransfer" | "priority"
> & { createdAt?: string }

export type RuleSubject = {
  rawLabel: string
  merchant: string | null
  providerCategory: string | null
}

export type RuleOutcome = {
  ruleId: string
  categoryId: string | null
  markAsTransfer: boolean
}

export type PreparedRuleSubject = {
  raw: (field: RuleField) => string | null
  normalized: (field: RuleField) => string | null
}

export type CompiledRule = {
  rule: RuleInput
  test: (subject: PreparedRuleSubject) => boolean
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

type Matcher = { ok: true; test: (subject: PreparedRuleSubject) => boolean } | { ok: false; message: string }

export function regexError(pattern: string): string | null {
  try {
    new RegExp(pattern, "iu")
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function containsMatcher(field: RuleField, pattern: string): Matcher {
  const needle = normalizeLabel(pattern)
  if (needle === "") return { ok: false, message: "Motif vide" }
  return { ok: true, test: (subject) => subject.normalized(field)?.includes(needle) ?? false }
}

function regexMatcher(field: RuleField, pattern: string): Matcher {
  if (pattern === "") return { ok: false, message: "Motif vide" }
  const error = regexError(pattern)
  if (error !== null) return { ok: false, message: error }
  const regex = new RegExp(pattern, "iu")
  return {
    ok: true,
    test: (subject) => {
      const value = subject.raw(field)
      return value !== null && regex.test(value)
    },
  }
}

function buildMatcher(rule: RuleInput): Matcher {
  return rule.matchKind === "regex" ? regexMatcher(rule.field, rule.pattern) : containsMatcher(rule.field, rule.pattern)
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

export function prepareRuleSubject(subject: RuleSubject): PreparedRuleSubject {
  const normalized = new Map<RuleField, string | null>()
  return {
    raw: (field) => fieldValue(field, subject),
    normalized: (field) => {
      const cached = normalized.get(field)
      if (cached !== undefined) return cached
      const value = fieldValue(field, subject)
      const result = value === null ? null : normalizeLabel(value)
      normalized.set(field, result)
      return result
    },
  }
}

export function hasEffect(rule: Pick<RuleInput, "categoryId" | "markAsTransfer">): boolean {
  return rule.categoryId !== null || rule.markAsTransfer
}

function byPriorityThenAge(left: RuleInput, right: RuleInput): number {
  if (left.priority !== right.priority) return right.priority - left.priority
  if (left.createdAt === undefined || right.createdAt === undefined) return 0
  return left.createdAt.localeCompare(right.createdAt)
}

export function compileRule(rule: RuleInput): CompiledRule | null {
  const matcher = buildMatcher(rule)
  return matcher.ok ? { rule, test: matcher.test } : null
}

export function compileRules(rules: RuleInput[]): CompiledRules {
  const compiled: CompiledRule[] = []
  const invalid: InvalidRule[] = []
  for (const rule of rules.filter(hasEffect).sort(byPriorityThenAge)) {
    const matcher = buildMatcher(rule)
    if (matcher.ok) compiled.push({ rule, test: matcher.test })
    else invalid.push({ rule, message: matcher.message })
  }
  return { compiled, invalid }
}

export function ruleMatches(rule: RuleInput, subject: RuleSubject): boolean {
  return compileRule(rule)?.test(prepareRuleSubject(subject)) ?? false
}

function toOutcome(rule: RuleInput): RuleOutcome {
  return {
    ruleId: rule.id,
    categoryId: rule.categoryId,
    markAsTransfer: rule.markAsTransfer,
  }
}

export function applyCompiledRules(compiled: CompiledRule[], subject: RuleSubject): RuleOutcome | null {
  const prepared = prepareRuleSubject(subject)
  const winner = compiled.find((candidate) => hasEffect(candidate.rule) && candidate.test(prepared))
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
