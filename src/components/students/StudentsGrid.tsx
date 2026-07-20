'use client';

import Link from 'next/link';
import { AlertTriangle, Shield, Mail, Phone, Calendar, Users, Plus, TrendingDown } from 'lucide-react';
import type { StudentRow } from './StudentsTable';

/* ------------------------------------------------------------------ */
/*  Name → deterministic avatar colour (stable across renders)         */
/* ------------------------------------------------------------------ */
function nameToColour(name: string): string {
    const colours = [
        'bg-primary/20 text-primary', 'bg-secondary text-foreground', 'bg-success/20 text-success', 'bg-warning/20 text-warning',
        'bg-destructive/20 text-destructive', 'bg-primary/40 text-primary', 'bg-success/40 text-success', 'bg-warning/40 text-warning',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colours[Math.abs(hash) % colours.length];
}

/* ------------------------------------------------------------------ */
/*  Component                                                           */
/* ------------------------------------------------------------------ */
interface StudentsGridProps {
    students: StudentRow[];
}

export default function StudentsGrid({ students }: StudentsGridProps) {
    if (students.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-6 ring-1 ring-primary/20">
                    <Users className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">No students yet</h3>
                <p className="text-muted-foreground mb-8 max-w-xs mx-auto">
                    Students will appear here once they register or book sessions, or you can add one manually.
                </p>
                <Link
                    href="/dashboard/students/add"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-primary rounded-2xl text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/30 glow-btn"
                >
                    <Plus className="w-4 h-4" /> Add New Student
                </Link>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {students.map((student) => {
                const initials = `${student.firstName[0]}${student.lastName[0]}`.toUpperCase();
                const avatarColour = nameToColour(`${student.firstName} ${student.lastName}`);
                const hasMedical = student.medicalNotes.length > 0;
                const hasSafeguarding = student.safeguardingNotes.length > 0;
                const hasAlerts = hasMedical || hasSafeguarding;

                return (
                    <Link
                        key={student.id}
                        href={`/dashboard/students/${student.id}`}
                        className="group relative bg-card border border-border rounded-[24px] p-5 hover:border-primary/30 hover:shadow-md transition-all flex flex-col gap-4"
                    >
                        {/* Alert badges — top-right corner */}
                        {hasAlerts && (
                            <div className="absolute top-3 right-3 flex items-center gap-1.5">
                                {hasMedical && (
                                    <div
                                        className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 border border-destructive/20 shadow-[0_0_8px_rgba(var(--destructive-rgb),0.15)]"
                                        title={`Medical: ${student.medicalNotes.join(' | ')}`}
                                    >
                                        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                                    </div>
                                )}
                                {hasSafeguarding && (
                                    <div
                                        className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 border border-primary/20"
                                        title={`Safeguarding: ${student.safeguardingNotes.join(' | ')}`}
                                    >
                                        <Shield className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Avatar + Name */}
                        <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-2xl ${avatarColour} flex items-center justify-center font-black text-lg flex-shrink-0 shadow-lg`}>
                                {initials}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-bold text-foreground text-sm truncate group-hover:text-primary transition-colors">
                                    {student.firstName} {student.lastName}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {(() => {
                                        const yr = student.schoolYear;
                                        let colour = 'bg-secondary border-border text-foreground';
                                        if (yr === 'Reception' || yr === 'Y1' || yr === 'Y2') colour = 'bg-primary/10 border-primary/30 text-primary';
                                        else if (['Y3','Y4','Y5','Y6'].includes(yr ?? ''))    colour = 'bg-success/10 border-success/30 text-success';
                                        else if (['Y7','Y8','Y9'].includes(yr ?? ''))          colour = 'bg-warning/10 border-warning/30 text-warning';
                                        else if (['Y10','Y11'].includes(yr ?? ''))             colour = 'bg-destructive/10 border-destructive/30 text-destructive';
                                        else if (['Y12','Y13'].includes(yr ?? ''))             colour = 'bg-destructive/10 border-destructive/30 text-destructive';
                                        return yr ? (
                                            <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${colour}`}>
                                                {yr}
                                            </span>
                                        ) : null;
                                    })()}
                                    {student.isRegistered && (
                                        <span className="px-2 py-0.5 rounded-full bg-success/10 border border-success/40 text-[10px] font-bold text-success uppercase tracking-wider whitespace-nowrap">
                                            Reg
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Parent contact */}
                        <div className="border-t border-border pt-3 space-y-1.5">
                            <p className="text-xs font-semibold text-foreground truncate">
                                {student.parentFirstName} {student.parentLastName}
                            </p>
                            {student.parentEmail && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                                    <Mail className="w-3 h-3 flex-shrink-0 text-muted-foreground/60" />
                                    {student.parentEmail}
                                </p>
                            )}
                            {student.parentPhone && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                                    <Phone className="w-3 h-3 flex-shrink-0 text-muted-foreground/60" />
                                    {student.parentPhone}
                                </p>
                            )}
                        </div>

                        {/* Stats footer */}
                        <div className="flex items-center justify-between border-t border-border pt-3 mt-auto">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                                <Calendar className="w-3 h-3 text-muted-foreground/60" />
                                {student.bookingCount} booking{student.bookingCount !== 1 ? 's' : ''}
                            </div>
                            {student.bookingCount > 0 && (
                                <span className={`text-[11px] font-bold ${student.attendanceRate >= 80 ? 'text-success' : student.attendanceRate >= 50 ? 'text-warning' : 'text-destructive'}`}>
                                    {Math.round(student.attendanceRate)}% att.
                                </span>
                            )}
                        </div>

                        {/* Medical alert preview strip */}
                        {hasMedical && (
                            <div className="bg-destructive/5 border border-destructive/15 rounded-xl px-3 py-2 flex items-center gap-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                                <p className="text-[11px] text-destructive font-semibold line-clamp-1">
                                    {student.medicalNotes[0]}
                                </p>
                            </div>
                        )}

                        {/* Low attendance alert strip */}
                        {student.lowAttendance && (
                            <div className="bg-warning/5 border border-warning/15 rounded-xl px-3 py-2 flex items-center gap-2">
                                <TrendingDown className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                                <p className="text-[11px] text-warning font-semibold">
                                    Low attendance · {Math.round(student.attendanceRate)}%
                                </p>
                            </div>
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
