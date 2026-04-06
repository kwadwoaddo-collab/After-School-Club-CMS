'use client';

import {
    Phone,
    Mail,
    Calendar,
    GraduationCap,
    AlertTriangle,
    Clock,
    User,
    ChevronLeft,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/components/ui/utils';
import InternalNotesTimeline from '@/components/students/InternalNotesTimeline';
import { AttendanceRadial } from '@/components/ui/AttendanceRadial';

interface AssessmentProfileProps {
    student: {
        id: string;
        firstName: string;
        lastName: string;
        dateOfBirth: Date | null;
        schoolYear: string;
        notes: string | null;
        registeredSessions?: string[] | null;
        parent: {
            firstName: string;
            lastName: string;
            phone: string | null;
            email: string | null;
        };
        bookings: Array<{
            id: string;
            startAt: Date;
            status: string;
            centreName: string;
            attendeeId: string;
            feedbackNotes: string | null;
            feedbackScore: string | null;
            feedbackStatus: string;
            feedbackAttachmentBase64: string | null;
            feedbackAttachmentMime: string | null;
            feedbackSentAt: Date | null;
        }>;
        attendanceStats?: { total: number; completed: number };
    };
    initialNotes: Array<{
        id: string;
        content: string;
        authorName: string;
        createdAt: Date;
    }>;
}

export default function StudentProfile({ student, initialNotes }: AssessmentProfileProps) {
    const fullName = `${student.firstName} ${student.lastName}`;
    const parentFullName = `${student.parent.firstName} ${student.parent.lastName}`;



    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header / Nav */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard/students" className="group flex items-center gap-2 text-on-surface-variant hover:text-white transition-colors">
                    <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center group-hover:border-outline-variant/50 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold">Back to Students</span>
                </Link>
                <div className="flex gap-3">
                    <Link
                        href={`/dashboard/bookings/new?studentId=${student.id}`}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all"
                    >
                        Create Booking
                    </Link>
                </div>
            </div>

            {/* Assessment Card Detail */}
            <div className="bg-surface-container-high border border-outline-variant/10 rounded-[48px] overflow-hidden shadow-2xl shadow-black/50">
                {/* Visual Header */}
                <div className="bg-gradient-to-r from-primary/10 via-violet-500/10 to-transparent p-12 pb-0">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <AttendanceRadial 
                            percentage={student.attendanceStats ? (student.attendanceStats.completed / (student.attendanceStats.total || 1)) * 100 : 0} 
                            size="lg"
                        >
                            <div className="w-full h-full bg-surface-container-low flex items-center justify-center relative group">
                                <User className="w-16 h-16 text-outline-variant group-hover:scale-110 transition-transform" />
                                <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </AttendanceRadial>
                        <div className="text-center md:text-left space-y-2">
                            <div className="flex items-center justify-center md:justify-start gap-3">
                                <h1 className="text-4xl font-black text-white tracking-tight">{fullName}</h1>
                            </div>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-on-surface-variant">
                                <span className="flex items-center gap-1.5 font-bold text-sm">
                                    <GraduationCap className="w-4 h-4 text-primary" />
                                    {student.schoolYear}
                                </span>
                                <span className="w-1 h-1 bg-outline-variant/40 rounded-full" />
                                <span className="flex items-center gap-1.5 font-bold text-sm">
                                    <Calendar className="w-4 h-4 text-violet-500" />
                                    Born: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* General Stats Bar */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 border-t border-outline-variant/10">
                        <div className="p-8 border-b md:border-b-0 md:border-r border-outline-variant/10 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Total Bookings</span>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span className="text-lg font-black text-white">
                                    {student.bookings.length}
                                </span>
                            </div>
                        </div>
                        <div className="p-8 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">Attendance Status</span>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-emerald-400" />
                                <span className="text-lg font-black text-white">
                                    {student.attendanceStats?.completed || 0} / {student.attendanceStats?.total || 0} Attended
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-12 pt-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Left Panel: Contact & Feedback Panel */}
                    <div className="space-y-8">
                        <div>
                            <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em] mb-6">Parent Information</h3>
                            <div className="bg-surface-container-low rounded-[32px] p-6 border border-outline-variant/10">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-surface-container-high border border-outline-variant/10 flex items-center justify-center text-on-surface-variant">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-black text-white">{parentFullName}</p>
                                        <p className="text-xs font-bold text-primary italic">Parent / Guardian Contact</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <a href={`tel:${student.parent.phone}`} className="flex items-center justify-between p-4 bg-surface-container-high rounded-2xl border border-outline-variant/10 hover:border-primary/30 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-bold text-white">{student.parent.phone || 'No phone'}</span>
                                        </div>
                                        <ChevronLeft className="w-4 h-4 text-outline-variant rotate-180" />
                                    </a>
                                    <a href={`mailto:${student.parent.email}`} className="flex items-center justify-between p-4 bg-surface-container-high rounded-2xl border border-outline-variant/10 hover:border-violet-500/30 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <Mail className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-bold text-white truncate max-w-[180px]">{student.parent.email || 'No email'}</span>
                                        </div>
                                        <ChevronLeft className="w-4 h-4 text-outline-variant rotate-180" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Selected Sessions Card */}
                        <div className="bg-surface-container-low rounded-[32px] p-6 border border-outline-variant/10">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar className="w-5 h-5 text-primary" />
                                <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-widest">Selected Days</h3>
                            </div>
                            {student.registeredSessions && student.registeredSessions.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {student.registeredSessions.map((session, idx) => (
                                        <span key={idx} className="bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-xl text-sm font-bold">
                                            {session}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-on-surface-variant font-medium">No preferred sessions recorded.</p>
                            )}
                        </div>

                        {student.notes && (
                            <div className="bg-error/10 rounded-[32px] p-8 border border-error/20">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-error" />
                                    <h3 className="text-xs font-black text-error uppercase tracking-widest">Medical &amp; Safety Notes</h3>
                                </div>
                                <p className="text-sm font-bold text-error leading-relaxed">
                                    {student.notes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Internal Notes */}
                    <div className="space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em]">Internal Notes</h3>
                            </div>

                            <InternalNotesTimeline childId={student.id} initialNotes={initialNotes} />
                        </div>

                        {/* Recent Bookings List */}
                        <div className="bg-surface-container-low rounded-[32px] p-6 border border-outline-variant/10">
                            <h3 className="text-xs font-black text-on-surface-variant uppercase tracking-[0.2em] mb-4">Recent Bookings</h3>
                            
                            {student.bookings.length > 0 ? (
                                <div className="space-y-3">
                                    {student.bookings.slice(0, 3).map(booking => (
                                        <div key={booking.id} className="p-4 rounded-2xl bg-surface-container-high border border-outline-variant/10 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-white">
                                                    {new Date(booking.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} 
                                                </p>
                                                <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} • {booking.centreName}
                                                </p>
                                            </div>
                                            <span className={cn(
                                                "text-[10px] font-black uppercase rounded-full px-3 py-1",
                                                    booking.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    booking.status === 'cancelled' ? 'bg-error/20 text-error' :
                                                'bg-primary/10 text-primary'
                                            )}>
                                                {booking.status}
                                            </span>
                                        </div>
                                    ))}
                                    {student.bookings.length > 3 && (
                                        <div className="pt-2 text-center text-xs font-bold text-on-surface-variant">
                                            + {student.bookings.length - 3} more bookings
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-sm text-on-surface-variant">No bookings found for this student.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
