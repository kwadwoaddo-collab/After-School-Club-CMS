import Link from 'next/link';
import { Mail, Phone, Baby } from 'lucide-react';
import type { ParentRow } from './ParentsTable';

/* ------------------------------------------------------------------ */
/*  Mobile record card — InvoiceFlow's "tables collapse to stacked      */
/*  cards below md" pattern, directly modelled on StudentsGrid.tsx.     */
/*  ParentsTable owns the empty state, so this component only ever      */
/*  receives a non-empty list. No event handlers here — ParentsTable    */
/*  is a Server Component with prior RSC-serialization crash history    */
/*  (see ParentsTable.test.tsx), so this stays plain links/anchors      */
/*  only, exactly like the table variant above it.                      */
/* ------------------------------------------------------------------ */
interface ParentsGridProps {
    parents: ParentRow[];
}

function getInitials(firstName: string, lastName: string) {
    return `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}`.toUpperCase();
}

export default function ParentsGrid({ parents }: ParentsGridProps) {
    return (
        <div className="flex flex-col gap-3">
            {parents.map((parent) => {
                const fullName = `${parent.firstName} ${parent.lastName}`;
                const initials = getInitials(parent.firstName, parent.lastName);

                return (
                    <Link
                        key={parent.id}
                        href={`/dashboard/parents/${parent.id}`}
                        className="block rounded-lg border border-border bg-surface p-4 active:bg-page/60 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-table-value font-medium text-text truncate">{fullName}</p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    <span className="text-metadata flex items-center gap-1.5">
                                        <Baby className="w-3 h-3 text-text-muted" />
                                        {parent.childCount} {parent.childCount === 1 ? 'child' : 'children'}
                                    </span>
                                </div>
                            </div>
                            {parent.outstanding > 0 ? (
                                <span className="text-small-body font-semibold text-danger flex-shrink-0">
                                    £{parent.outstanding.toFixed(2)}
                                </span>
                            ) : (
                                <span className="text-metadata flex-shrink-0">£0.00</span>
                            )}
                        </div>

                        {(parent.email || parent.phone) && (
                            <div className="mt-3 pt-3 border-t border-border-subtle space-y-1">
                                {parent.email && (
                                    <p className="text-metadata flex items-center gap-1.5 truncate">
                                        <Mail className="w-3 h-3 flex-shrink-0 text-text-muted" />
                                        {parent.email}
                                    </p>
                                )}
                                {parent.phone && (
                                    <p className="text-metadata flex items-center gap-1.5 truncate">
                                        <Phone className="w-3 h-3 flex-shrink-0 text-text-muted" />
                                        {parent.phone}
                                    </p>
                                )}
                            </div>
                        )}

                        {parent.childrenList && parent.childrenList.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border-subtle flex flex-wrap gap-1">
                                {parent.childrenList.map((child) => (
                                    <span
                                        key={child.id}
                                        className="inline-flex items-center px-2 py-0.5 rounded-sm bg-page border border-border-subtle text-text-secondary text-xs font-medium whitespace-nowrap"
                                    >
                                        {child.first_name} {child.last_name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
