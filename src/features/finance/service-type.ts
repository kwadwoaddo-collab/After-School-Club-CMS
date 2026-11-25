export const SERVICE_TYPES = ['childcare', 'tuition'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export function isServiceType(value: unknown): value is ServiceType {
    return typeof value === 'string' && (SERVICE_TYPES as readonly string[]).includes(value);
}

/** Anything unknown or missing (legacy rows, ad-hoc invoices) is childcare. */
export function normaliseServiceType(value: unknown): ServiceType {
    return isServiceType(value) ? value : 'childcare';
}

/** Parent-facing label used on invoices/receipts: "Childcare" or "Tuition". */
export function serviceTypeLabel(value: unknown): string {
    return normaliseServiceType(value) === 'tuition' ? 'Tuition' : 'Childcare';
}
