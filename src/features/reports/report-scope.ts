/** A report scope can only narrow the centres already granted by the server. */
export function reportCentreIds(accessibleIds: string[], requested = 'all'): string[] {
    if (!accessibleIds.length) throw new Error('No accessible centres');
    if (requested === 'all') return [...accessibleIds];
    if (!accessibleIds.includes(requested)) throw new Error('No access to the selected report centre');
    return [requested];
}
