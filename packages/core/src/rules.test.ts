import { describe, expect, it } from "vitest"
import { applyRules, compileRules, type RuleInput, ruleMatches, type RuleSubject, suggestRulePattern } from "./rules"

function rule(overrides: Partial<RuleInput> & Pick<RuleInput, "id" | "pattern">): RuleInput {
  return {
    matchKind: "contains",
    field: "raw_label",
    categoryId: null,
    fixedItemId: null,
    markAsTransfer: false,
    priority: 0,
    ...overrides,
  }
}

function subject(overrides: Partial<RuleSubject> = {}): RuleSubject {
  return { rawLabel: "Achat Épicerie Fictive Lausanne", merchant: null, providerCategory: null, ...overrides }
}

describe("ruleMatches", () => {
  it("ignores case and accents with contains", () => {
    expect(ruleMatches(rule({ id: "r", pattern: "EPICERIE fictive" }), subject())).toBe(true)
    expect(ruleMatches(rule({ id: "r", pattern: "épicerie" }), subject({ rawLabel: "ACHAT EPICERIE" }))).toBe(true)
  })

  it("collapses whitespace with contains", () => {
    expect(ruleMatches(rule({ id: "r", pattern: "achat  épicerie" }), subject())).toBe(true)
  })

  it("does not match unrelated labels", () => {
    expect(ruleMatches(rule({ id: "r", pattern: "boulangerie" }), subject())).toBe(false)
  })

  it("matches a case-insensitive regex on the raw value", () => {
    const regexRule = rule({ id: "r", pattern: "^achat é\\w+", matchKind: "regex" })
    expect(ruleMatches(regexRule, subject())).toBe(true)
    expect(ruleMatches(regexRule, subject({ rawLabel: "Achat Epicerie" }))).toBe(false)
  })

  it("never throws on an invalid regex", () => {
    expect(ruleMatches(rule({ id: "r", pattern: "(unclosed", matchKind: "regex" }), subject())).toBe(false)
  })

  it("reads the provider category field", () => {
    const categoryRule = rule({ id: "r", pattern: "comestibles", field: "provider_category" })
    expect(ruleMatches(categoryRule, subject({ providerCategory: "Comestibles" }))).toBe(true)
    expect(ruleMatches(categoryRule, subject({ rawLabel: "Comestibles" }))).toBe(false)
  })

  it("never matches a null field", () => {
    expect(ruleMatches(rule({ id: "r", pattern: "fictive", field: "merchant" }), subject())).toBe(false)
    expect(ruleMatches(rule({ id: "r", pattern: ".*", matchKind: "regex", field: "merchant" }), subject())).toBe(false)
  })

  it("never matches an empty pattern", () => {
    expect(ruleMatches(rule({ id: "r", pattern: "   " }), subject())).toBe(false)
  })
})

describe("compileRules", () => {
  it("reports invalid regexes and keeps the others", () => {
    const { compiled, invalid } = compileRules([
      rule({ id: "broken", pattern: "[a-", matchKind: "regex" }),
      rule({ id: "valid", pattern: "fictive" }),
    ])
    expect(compiled.map((entry) => entry.rule.id)).toEqual(["valid"])
    expect(invalid.map((entry) => entry.rule.id)).toEqual(["broken"])
  })

  it("sorts by descending priority then by creation date", () => {
    const { compiled } = compileRules([
      rule({ id: "low", pattern: "a", priority: 1, createdAt: "2026-01-01T00:00:00.000Z" }),
      rule({ id: "newer", pattern: "a", priority: 5, createdAt: "2026-03-01T00:00:00.000Z" }),
      rule({ id: "older", pattern: "a", priority: 5, createdAt: "2026-02-01T00:00:00.000Z" }),
    ])
    expect(compiled.map((entry) => entry.rule.id)).toEqual(["older", "newer", "low"])
  })
})

describe("applyRules", () => {
  it("returns null when nothing matches", () => {
    expect(applyRules([rule({ id: "r", pattern: "boulangerie" })], subject())).toBeNull()
  })

  it("lets the highest priority win", () => {
    const outcome = applyRules(
      [
        rule({ id: "generic", pattern: "achat", categoryId: "shopping", priority: 1 }),
        rule({ id: "specific", pattern: "épicerie", categoryId: "food", priority: 10 }),
      ],
      subject(),
    )
    expect(outcome).toEqual({ ruleId: "specific", categoryId: "food", fixedItemId: null, markAsTransfer: false })
  })

  it("lets the oldest rule win on equal priority", () => {
    const outcome = applyRules(
      [
        rule({ id: "newer", pattern: "achat", categoryId: "b", priority: 3, createdAt: "2026-05-01T00:00:00.000Z" }),
        rule({ id: "older", pattern: "achat", categoryId: "a", priority: 3, createdAt: "2026-04-01T00:00:00.000Z" }),
      ],
      subject(),
    )
    expect(outcome?.ruleId).toBe("older")
  })

  it("skips an invalid regex even with a higher priority", () => {
    const outcome = applyRules(
      [
        rule({ id: "broken", pattern: "(", matchKind: "regex", priority: 100 }),
        rule({ id: "transfer", pattern: "fictive", markAsTransfer: true, priority: 1 }),
      ],
      subject(),
    )
    expect(outcome).toMatchObject({ ruleId: "transfer", markAsTransfer: true })
  })
})

describe("suggestRulePattern", () => {
  it("prefers the merchant", () => {
    expect(suggestRulePattern(subject({ merchant: " Epicerie Fictive " }))).toEqual({
      field: "merchant",
      pattern: "Epicerie Fictive",
    })
  })

  it("strips date, time and card number from a card purchase", () => {
    const label = "Achat COMMERCE 01.02.2026, 12:34, No carte V PAY 12345678"
    expect(suggestRulePattern(subject({ rawLabel: label }))).toEqual({ field: "raw_label", pattern: "Achat COMMERCE" })
  })

  it("strips the TWINT number and keeps the first significant segment", () => {
    const label = "Transfert TWINT à NOM, PRENOM No TWINT 12345678"
    expect(suggestRulePattern(subject({ rawLabel: label }))).toEqual({
      field: "raw_label",
      pattern: "Transfert TWINT à NOM",
    })
  })

  it("stops before digit runs inside the label", () => {
    const label = "Achat Magasin-1234 Ville 01.02.2026, 12:34, No carte V PAY 12345678"
    expect(suggestRulePattern(subject({ rawLabel: label })).pattern).toBe("Achat Magasin")
  })

  it("extends past generic segments", () => {
    const label = "Achat TWINT, PARKING FICTIF 01.02.2026"
    expect(suggestRulePattern(subject({ rawLabel: label })).pattern).toBe("Achat TWINT, PARKING FICTIF")
  })

  it("produces a pattern that matches its own transaction", () => {
    const source = subject({ rawLabel: "Achat Magasin-1234 Ville 01.02.2026, 12:34" })
    const suggestion = suggestRulePattern(source)
    expect(ruleMatches(rule({ id: "r", ...suggestion }), source)).toBe(true)
  })

  it("falls back to the full label when nothing remains", () => {
    expect(suggestRulePattern(subject({ rawLabel: "12345678" })).pattern).toBe("12345678")
  })
})
