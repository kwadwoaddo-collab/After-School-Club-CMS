export const CANONICAL_SCHOOL_YEARS = [
    'Reception',
    'Y1',
    'Y2',
    'Y3',
    'Y4',
    'Y5',
    'Y6',
    'Y7',
    'Y8',
    'Y9',
    'Y10',
    'Y11',
    'Y12',
    'Y13',
] as const;

export type CanonicalSchoolYear = (typeof CANONICAL_SCHOOL_YEARS)[number];

/**
 * Normalizes any raw school year input into canonical storage format:
 * 'Reception', 'Y1'..'Y13' (or 'Nursery' / 'Graduated' when applicable).
 * Defaults to 'Y1' when empty/null.
 */
export function normalizeSchoolYear(raw?: string | null): string {
    if (!raw || !raw.trim()) return 'Y1';
    const cleaned = raw.trim();
    const lower = cleaned.toLowerCase();

    if (['reception', 'rec', 'r', 'year r', 'yr r', 'year reception', 'yr reception'].includes(lower)) {
        return 'Reception';
    }
    if (['nursery', 'nur', 'n', 'year n', 'yr n', 'year nursery', 'yr nursery'].includes(lower)) {
        return 'Nursery';
    }
    if (lower === 'graduated') {
        return 'Graduated';
    }

    const yearMatch = lower.match(/^(?:year\s*|yr\.?\s*|y)?(\d{1,2})$/i);
    if (yearMatch) {
        const num = parseInt(yearMatch[1], 10);
        if (num === 0) return 'Reception';
        if (num >= 1 && num <= 13) {
            return `Y${num}`;
        }
    }

    return cleaned;
}

/**
 * Formats a school year value for human-friendly UI display without ever
 * producing "Year Y4", "Yr Y4", or "Year Reception".
 */
export function formatSchoolYearLabel(raw?: string | null, style: 'long' | 'short' = 'long'): string {
    if (!raw || !raw.trim()) return 'Year N/A';
    const norm = normalizeSchoolYear(raw);

    if (norm === 'Reception' || norm === 'Nursery' || norm === 'Graduated') {
        return norm;
    }

    const match = norm.match(/^Y(\d{1,2})$/i);
    if (match) {
        return style === 'short' ? `Y${match[1]}` : `Year ${match[1]}`;
    }

    return norm;
}
