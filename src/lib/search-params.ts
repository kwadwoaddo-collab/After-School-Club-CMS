import { isValid, parseISO } from 'date-fns';

/**
 * Normalizes a search param that might be an array or undefined into a single string.
 */
export function normalizeString(param: string | string[] | undefined): string | undefined;
export function normalizeString(param: string | string[] | undefined, fallback: string): string;
export function normalizeString(param: string | string[] | undefined, fallback?: string): string | undefined {
    if (!param) return fallback;
    const value = Array.isArray(param) ? param[0] : param;
    return value || fallback;
}

/**
 * Normalizes a search param into a valid enum value, falling back to a default.
 */
export function normalizeEnum<T extends string, F extends string>(
    param: string | string[] | undefined,
    allowedValues: readonly T[],
    fallback: F
): T | F {
    const value = normalizeString(param);
    if (value && allowedValues.includes(value as T)) {
        return value as T;
    }
    return fallback;
}

/**
 * Normalizes a search param into a valid date string, or undefined if invalid.
 */
export function normalizeDate(param: string | string[] | undefined): string | undefined {
    const value = normalizeString(param);
    if (!value) return undefined;
    const parsed = parseISO(value);
    if (isValid(parsed)) {
        return value;
    }
    return undefined;
}

/** Reject non-finite, fractional and oversized offsets before they reach SQL. */
export function normalizePage(param: string | string[] | undefined, pageSize = 50): number {
    const value = normalizeString(param);
    if (!value || !/^[1-9]\d*$/.test(value)) return 1;
    const page = Number(value);
    return Number.isSafeInteger(page) && Number.isSafeInteger((page - 1) * pageSize) && (page - 1) * pageSize <= 2_147_483_647 ? page : 1;
}
