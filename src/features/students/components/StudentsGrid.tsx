'use client';

import Link from 'next/link';
import { AlertTriangle, Shield, Mail, Phone, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import type { StudentRow } from './StudentsTable';

/* ------------------------------------------------------------------ */
/*  Mobile record card — InvoiceFlow's "tables collapse to stacked      */
/*  cards below md" pattern. Rendered by StudentsTable for narrow       */
/*  viewports; StudentsTable owns the empty state, so this component    */
/*  only ever receives a non-empty list.                                */
/* ------------------------------------------------------------------ */
interface StudentsGridProps {
    students: StudentRow[];
}

export default function StudentsGrid({ students }: StudentsGridProps) {
    return (
        <div className="flex flex-col gap-3">
            {students.map((student) => {
                const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase();
                const hasMedical = student.medicalNotes.length > 0;
                const hasSafeguarding = student.safeguardingNotes.length > 0;
                const hasAlerts = hasMedical || hasSafeguarding;

                return (
                    <Link
                        key={student.id}
                        href={`/dashboard/students/${student.id}`}
                        className="block rounded-lg border border-border bg-surface p-4 active:bg-page/60 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className="text-table-value font-medium text-text truncate">
                                        {student.firstName} {student.lastName}
                                    </p>
                                    {student.isRegistered && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" title="Registered" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {student.schoolYear && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-sm border border-border-subtle bg-page text-text-secondary text-xs font-medium">
                                            {student.schoolYear}
                                        </span>
                                    )}
                                    {hasAlerts && (
                                        <Badge variant="error">
                                            {hasMedical && hasSafeguarding ? (
                                                <>
                                                    <AlertTriangle className="w-3 h-3" /> Medical / safeguarding
                                                </>
                                            ) : hasMedical ? (
                                                <>
                                                    <AlertTriangle className="w-3 h-3" /> Medical
                                                </>
                                            ) : (
                                                <>
                                                    <Shield className="w-3 h-3" /> Safeguarding
                                                </>
                                            )}
                                        </Badge>
                                    )}
                                    {student.lowAttendance && <Badge variant="warning">Low attendance</Badge>}
                                </div>
                            </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border-subtle space-y-1">
                            <p className="text-small-body font-medium text-text truncate">
                                {student.parentFirstName} {student.parentLastName}
                            </p>
                            {student.parentEmail && (
                                <p className="text-metadata flex items-center gap-1.5 truncate">
                                    <Mail className="w-3 h-3 flex-shrink-0 text-text-muted" />
                                    {student.parentEmail}
                                </p>
                            )}
                            {student.parentPhone && (
                                <p className="text-metadata flex items-center gap-1.5 truncate">
                                    <Phone className="w-3 h-3 flex-shrink-0 text-text-muted" />
                                    {student.parentPhone}
                                </p>
                            )}
                        </div>

                        <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
                            <span className="text-metadata flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-text-muted" />
                                {student.bookingCount} booking{student.bookingCount !== 1 ? 's' : ''}
                            </span>
                            {student.bookingCount > 0 && (
                                <span
                                    className={`text-metadata font-semibold ${
                                        student.attendanceRate >= 80
                                            ? 'text-success'
                                            : student.attendanceRate >= 50
                                              ? 'text-warning'
                                              : 'text-danger'
                                    }`}
                                >
                                    {Math.round(student.attendanceRate)}% attendance
                                </span>
                            )}
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
