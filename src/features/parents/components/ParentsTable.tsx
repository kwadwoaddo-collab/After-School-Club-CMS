import Link from 'next/link';
import { AlertTriangle, Mail, Phone, Users, Search, ChevronRight } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import DeleteParentButton from '@/features/parents/components/DeleteParentButton';
import ParentsGrid from '@/features/parents/components/ParentsGrid';

export interface ParentRow {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    childCount: number;
    childrenList: Array<{ id: string; first_name: string; last_name: string }>;
    outstanding: number;
}

interface ParentsTableProps {
    parents: ParentRow[];
    error?: boolean;
    /** True when a search/filter is active — used to pick the right empty state. */
    hasActiveFilters?: boolean;
}

function getInitials(firstName: string, lastName: string) {
    return `${firstName.charAt(0) || ''}${lastName.charAt(0) || ''}`.toUpperCase();
}

function NoParentsEmptyState() {
    return (
        <EmptyState
            icon={<Users className="w-8 h-8" />}
            title="No parents yet"
            description="Parent and family records appear here once a student registers or is added, and are linked to their contact automatically."
        />
    );
}

function NoFilterMatchesEmptyState() {
    return (
        <EmptyState
            icon={<Search className="w-8 h-8" />}
            title="No parents match these filters"
            description="Try a different search or status — or clear filters to see every family."
        />
    );
}

export default function ParentsTable({ parents, error, hasActiveFilters }: ParentsTableProps) {
    if (error) {
        return (
            <div className="rounded-lg border border-danger/30 bg-danger-soft p-6 text-center">
                <AlertTriangle className="w-6 h-6 text-danger mx-auto mb-2" />
                <p className="text-card-heading text-text">Unable to load parents</p>
                <p className="text-small-body text-text-secondary">Some information may be missing or incomplete — please refresh the page.</p>
            </div>
        );
    }

    if (parents.length === 0) {
        return hasActiveFilters ? <NoFilterMatchesEmptyState /> : <NoParentsEmptyState />;
    }

    return (
        <>
            {/* Desktop / tablet — table. Collapses to stacked cards below `md`,
                mirroring the Students list's mobile pattern. */}
            <div className="hidden md:block rounded-lg border border-border bg-surface overflow-hidden">
                <Table caption="Parents list">
                    <TableHeader>
                        <TableRow>
                            <TableHead>Parent</TableHead>
                            <TableHead>Contact</TableHead>
                            <TableHead>Linked children</TableHead>
                            <TableHead align="right">Balance</TableHead>
                            <TableHead align="right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {parents.map((parent) => {
                            const fullName = `${parent.firstName} ${parent.lastName}`;
                            const initials = getInitials(parent.firstName, parent.lastName);

                            return (
                                <TableRow key={parent.id} className="group">
                                    <TableCell>
                                        <Link href={`/dashboard/parents/${parent.id}`} className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0">
                                                {initials}
                                            </div>
                                            <span className="text-table-value font-medium text-text truncate group-hover:text-accent transition-colors">
                                                {fullName}
                                            </span>
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 -ml-1">
                                            {parent.phone && (
                                                <a
                                                    href={`tel:${parent.phone}`}
                                                    className="p-1.5 hover:bg-page rounded-sm text-text-muted hover:text-text transition-colors inline-flex items-center justify-center"
                                                    title={parent.phone}
                                                >
                                                    <Phone className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                            {parent.email && (
                                                <a
                                                    href={`mailto:${parent.email}`}
                                                    className="p-1.5 hover:bg-page rounded-sm text-text-muted hover:text-text transition-colors inline-flex items-center justify-center"
                                                    title={parent.email}
                                                >
                                                    <Mail className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                            {!parent.phone && !parent.email && (
                                                <span className="text-text-muted">—</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {parent.childrenList && parent.childrenList.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {parent.childrenList.map((child) => (
                                                    <Link
                                                        key={child.id}
                                                        href={`/dashboard/students/${child.id}`}
                                                        title={`${child.first_name} ${child.last_name}`}
                                                        className="inline-flex items-center px-2 py-0.5 rounded-sm bg-accent-soft text-accent text-xs font-medium hover:opacity-80 transition-opacity whitespace-nowrap"
                                                    >
                                                        {child.first_name} {child.last_name}
                                                    </Link>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-text-muted">No children</span>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        {parent.outstanding > 0 ? (
                                            <span className="font-medium text-danger">£{parent.outstanding.toFixed(2)}</span>
                                        ) : (
                                            <span className="text-text-secondary">£0.00</span>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        <div className="flex items-center justify-end gap-1">
                                            <DeleteParentButton parentId={parent.id} parentName={fullName} childCount={parent.childCount} />
                                            <Link
                                                href={`/dashboard/parents/${parent.id}`}
                                                className="p-1.5 text-text-muted hover:text-accent hover:bg-page rounded-sm transition-colors inline-flex items-center justify-center"
                                                title={`View ${fullName}`}
                                            >
                                                <ChevronRight className="w-4 h-4" />
                                            </Link>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile — stacked record cards, not a horizontally-scrolled table. */}
            <div className="md:hidden">
                <ParentsGrid parents={parents} />
            </div>
        </>
    );
}
