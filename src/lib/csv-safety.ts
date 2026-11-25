/**
 * Milestone 3I & Wave 4B — shared CSV-export safety helper.
 *
 * Spreadsheet applications (Excel, Google Sheets, LibreOffice, Numbers) may
 * evaluate cells whose content begins with `=`, `+`, `-`, or `@` — including
 * when preceded by leading whitespace (` `, `\t`, `\r`, `\n`) or leading
 * control characters (`\t`, `\r`) — even inside double-quoted CSV cells.
 *
 * Standard mitigation (OWASP CSV Injection guidance): prefix any value matching
 * a leading formula trigger with a single quote (`'`), then escape embedded
 * double quotes (`""`) and wrap the cell in double quotes (`"..."`).
 */
const FORMULA_TRIGGERS = /^[\t\r\n ]*[=+\-@]|^[\t\r]/;

export function neutralizeCsvFormula(value: string): string {
  if (FORMULA_TRIGGERS.test(value)) {
    return `'${value}`;
  }
  return value;
}

export function encodeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${neutralizeCsvFormula(raw).replace(/"/g, '""')}"`;
}
