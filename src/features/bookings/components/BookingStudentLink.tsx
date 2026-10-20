import Link from 'next/link';
import type { ReactNode } from 'react';

/** Missing relationships must never become a profile URL or an invented identity. */
export function BookingStudentLink({ studentId, children, className }: {
    studentId?: string | null;
    children: ReactNode;
    className?: string;
}) {
    if (typeof studentId !== 'string' || !studentId.trim()) {
        return (
            <span className={className}>
                {children}
                <span className="block text-xs text-text-muted font-normal">Student link unavailable</span>
            </span>
        );
    }
    return (
        <Link href={`/dashboard/students/${studentId}`} className={className} onClick={(event) => event.stopPropagation()}>
            {children}
        </Link>
    );
}
