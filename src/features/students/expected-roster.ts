/** The SQL projection resolves lifecycle at the selected UK calendar date. */
export function expectedRosterIds(children: ReadonlyArray<{ id: string; effectiveEnrolmentStatus?: string | null }>): ReadonlySet<string> {
    return new Set(children.filter(child => (child.effectiveEnrolmentStatus ?? 'active') === 'active').map(child => child.id));
}
