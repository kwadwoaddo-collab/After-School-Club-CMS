/**
 * Milestone 3I — shared CSV-export safety helper.
 *
 * Every Reports CSV export (the two client-side exports in
 * src/app/dashboard/reports/ReportsClient.tsx, and the three server-side
 * exports under src/app/api/reports/*) already wraps every cell in double
 * quotes and escapes embedded quotes, which correctly prevents a value
 * containing a comma/newline/quote from breaking the CSV structure. That
 * quoting does NOT stop a spreadsheet application (Excel, Google Sheets,
 * LibreOffice) from evaluating a cell whose content begins with `=`, `+`,
 * `-`, or `@` as a formula, even when the cell is quoted — this is the
 * well-known "CSV/formula injection" class of defect. Several exported
 * fields (parent/child first and last name in particular) are free text a
 * parent supplies through the public self-registration flow
 * (src/app/centre-portal/[subdomain]/register/page.tsx), so this is
 * reachable from a normal, unprivileged submission path, not just a
 * theoretical concern. See project-notes/milestone-3i-reports-audit.md, O.8.
 *
 * Standard mitigation (OWASP CSV Injection guidance): prefix a value that
 * starts with one of the formula-trigger characters with a single quote,
 * which spreadsheet applications render as a literal leading character
 * rather than evaluating it, while leaving the value's own quoting/escaping
 * untouched.
 */
export function neutralizeCsvFormula(value: string): string {
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}
