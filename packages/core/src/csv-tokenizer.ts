export type CsvRecord = {
  line: number
  fields: string[]
}

const QUOTE = '"'
const BYTE_ORDER_MARK = "﻿"

class CsvTokenizer {
  private readonly records: CsvRecord[] = []
  private fields: string[] = []
  private field = ""
  private inQuotes = false
  private fieldWasQuoted = false
  private line = 1
  private recordLine = 1
  private index = 0

  constructor(
    private readonly text: string,
    private readonly delimiter: string,
  ) {}

  run(): CsvRecord[] {
    while (this.index < this.text.length) {
      if (this.inQuotes) this.readQuoted()
      else this.readUnquoted()
    }
    if (this.field !== "" || this.fields.length > 0 || this.fieldWasQuoted) this.endRecord()
    return this.records
  }

  private readQuoted(): void {
    const char = this.text.charAt(this.index)
    if (char === QUOTE) {
      if (this.text.charAt(this.index + 1) === QUOTE) {
        this.field += QUOTE
        this.index += 2
        return
      }
      this.inQuotes = false
      this.index++
      return
    }
    if (char === "\n") this.line++
    this.field += char
    this.index++
  }

  private readUnquoted(): void {
    const char = this.text.charAt(this.index)
    if (char === QUOTE && this.field === "") {
      this.inQuotes = true
      this.fieldWasQuoted = true
      this.index++
    } else if (char === this.delimiter) {
      this.endField()
      this.index++
    } else if (char === "\r" || char === "\n") {
      this.endRecord()
      this.index += char === "\r" && this.text.charAt(this.index + 1) === "\n" ? 2 : 1
      this.line++
      this.recordLine = this.line
    } else {
      this.field += char
      this.index++
    }
  }

  private endField(): void {
    this.fields.push(this.field)
    this.field = ""
    this.fieldWasQuoted = false
  }

  private endRecord(): void {
    const isBlank = this.fields.length === 0 && this.field === "" && !this.fieldWasQuoted
    this.endField()
    if (!isBlank) this.records.push({ line: this.recordLine, fields: this.fields })
    this.fields = []
  }
}

export function stripByteOrderMark(text: string): string {
  return text.startsWith(BYTE_ORDER_MARK) ? text.slice(BYTE_ORDER_MARK.length) : text
}

export function tokenizeCsv(text: string, delimiter: string): CsvRecord[] {
  return new CsvTokenizer(stripByteOrderMark(text), delimiter).run()
}
