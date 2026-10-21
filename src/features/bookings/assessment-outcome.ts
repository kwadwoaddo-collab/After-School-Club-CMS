/** Past appointments need a staff-recorded outcome; time alone never implies attendance. */
export function requiresAssessmentOutcome(status: string, startsAt: Date | string | null | undefined, now = new Date(), attendanceStatuses: Array<string | null | undefined> = []): boolean {
    if (attendanceStatuses.length > 0 && attendanceStatuses.every(Boolean)) return false;
    if (!['confirmed', 'pending'].includes(status) || !startsAt) return false;
    const timestamp = new Date(startsAt).getTime();
    return Number.isFinite(timestamp) && timestamp < now.getTime();
}
