export const FOLLOW_UP_FILTERS = ['all', 'overdue', 'today', 'upcoming', 'unscheduled'] as const;
export type FollowUpFilter = typeof FOLLOW_UP_FILTERS[number];
export function normalizeFollowUpFilter(value?: string): FollowUpFilter {
    return FOLLOW_UP_FILTERS.includes(value as FollowUpFilter) ? value as FollowUpFilter : 'all';
}
export function followUpBucket(nextContactDate: string | null | undefined, today: string): Exclude<FollowUpFilter, 'all'> {
    if (!nextContactDate) return 'unscheduled';
    return nextContactDate < today ? 'overdue' : nextContactDate === today ? 'today' : 'upcoming';
}
export const FOLLOW_UP_LABELS: Record<FollowUpFilter, string> = {
    all: 'All follow-ups', overdue: 'Overdue calls', today: 'Due today', upcoming: 'Upcoming calls', unscheduled: 'No call scheduled',
};
