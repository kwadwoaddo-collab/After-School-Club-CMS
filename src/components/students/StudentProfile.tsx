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
                <Link href="/dashboard" className="group flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center group-hover:border-slate-400 transition-all">
                        <ChevronLeft className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold">Back to Overview</span>
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
            <div className="glass-card rounded-[48px] overflow-hidden shadow-2xl shadow-slate-200/50 border-white/50">
                {/* Visual Header */}
                <div className="bg-gradient-to-r from-primary/5 via-violet-500/5 to-transparent p-12 pb-0">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <AttendanceRadial 
                            percentage={student.attendanceStats ? (student.attendanceStats.completed / (student.attendanceStats.total || 1)) * 100 : 0} 
                            size="lg"
                        >
                            <div className="w-full h-full bg-white flex items-center justify-center relative group">
                                <User className="w-16 h-16 text-slate-200 group-hover:scale-110 transition-transform" />
                                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </AttendanceRadial>
                        <div className="text-center md:text-left space-y-2">
                            <div className="flex items-center justify-center md:justify-start gap-3">
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight">{fullName}</h1>
                            </div>
                            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-500">
                                <span className="flex items-center gap-1.5 font-bold text-sm">
                                    <GraduationCap className="w-4 h-4 text-primary" />
                                    {student.schoolYear}
                                </span>
                                <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                <span className="flex items-center gap-1.5 font-bold text-sm">
                                    <Calendar className="w-4 h-4 text-violet-500" />
                                    Born: {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-GB') : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* General Stats Bar */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 border-t border-slate-100/50">
                        <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100/50 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Bookings</span>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span className="text-lg font-black text-slate-900">
                                    {student.bookings.length}
                                </span>
                            </div>
                        </div>
                        <div className="p-8 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Attendance Status</span>
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-emerald-500" />
                                <span className="text-lg font-black text-slate-900">
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
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Parent Information</h3>
                            <div className="bg-slate-50/50 rounded-[32px] p-6 border border-slate-100">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                                        <User className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="font-black text-slate-900">{parentFullName}</p>
                                        <p className="text-xs font-bold text-primary italic">Parent / Guardian Contact</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <a href={`tel:${student.parent.phone}`} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-primary/30 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-bold text-slate-700">{student.parent.phone || 'No phone'}</span>
                                        </div>
                                        <ChevronLeft className="w-4 h-4 text-slate-300 rotate-180" />
                                    </a>
                                    <a href={`mailto:${student.parent.email}`} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-violet-300 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <Mail className="w-4 h-4 text-violet-500 group-hover:scale-110 transition-transform" />
                                            <span className="text-sm font-bold text-slate-700 truncate max-w-[180px]">{student.parent.email || 'No email'}</span>
                                        </div>
                                        <ChevronLeft className="w-4 h-4 text-slate-300 rotate-180" />
                                    </a>
                                </div>
                            </div>
                        </div>

                        {/* Selected Sessions Card */}
                        <div className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Calendar className="w-5 h-5 text-blue-500" />
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Selected Days</h3>
                            </div>
                            {student.registeredSessions && student.registeredSessions.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {student.registeredSessions.map((session, idx) => (
                                        <span key={idx} className="bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-xl text-sm font-bold">
                                            {session}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 font-medium">No preferred sessions recorded.</p>
                            )}
                        </div>

                        {student.notes && (
                            <div className="bg-rose-50/50 rounded-[32px] p-8 border border-rose-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-rose-500" />
                                    <h3 className="text-xs font-black text-rose-900 uppercase tracking-widest">Medical & Safety Notes</h3>
                                </div>
                                <p className="text-sm font-bold text-rose-800 leading-relaxed">
                                    {student.notes}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right Panel: Internal Notes */}
                    <div className="space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Internal Notes</h3>
                            </div>

                            <InternalNotesTimeline childId={student.id} initialNotes={initialNotes} />
                        </div>

                        {/* Recent Bookings List */}
                        <div className="bg-white rounded-[32px] p-6 border border-slate-100">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Recent Bookings</h3>
                            
                            {student.bookings.length > 0 ? (
                                <div className="space-y-3">
                                    {student.bookings.slice(0, 3).map(booking => (
                                        <div key={booking.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-black text-slate-900">
                                                    {new Date(booking.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} 
                                                </p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(booking.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} • {booking.centreName}
                                                </p>
                                            </div>
                                            <span className={cn(
                                                "text-[10px] font-black uppercase rounded-full px-3 py-1",
                                                    booking.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                                                    booking.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                                                'bg-primary/10 text-primary'
                                            )}>
                                                {booking.status}
                                            </span>
                                        </div>
                                    ))}
                                    {student.bookings.length > 3 && (
                                        <div className="pt-2 text-center text-xs font-bold text-slate-400">
                                            + {student.bookings.length - 3} more bookings
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <p className="text-sm text-slate-400">No bookings found for this student.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
