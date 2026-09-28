const QUOTE = '"'
const LINE_BREAK = "\r\n"

export type CsvCell = string | number | null

function needsQuoting(value: string, delimiter: string): boolean {
  return (
    value.includes(delimiter) ||
    value.includes(QUOTE) ||
    value.includes("\n") ||
    value.includes("\r") ||
    value !== value.trim()
  )
}

export function encodeCsvField(cell: CsvCell, delimiter: string): string {
  const value = cell === null ? "" : String(cell)
  if (!needsQuoting(value, delimiter)) return value
  return `${QUOTE}${value.replaceAll(QUOTE, QUOTE + QUOTE)}${QUOTE}`
}

export function encodeCsvRow(cells: readonly CsvCell[], delimiter: string): string {
  return cells.map((cell) => encodeCsvField(cell, delimiter)).join(delimiter)
}

export function encodeCsv(rows: readonly (readonly CsvCell[])[], delimiter: string): string {
  return rows.map((row) => encodeCsvRow(row, delimiter) + LINE_BREAK).join("")
}
