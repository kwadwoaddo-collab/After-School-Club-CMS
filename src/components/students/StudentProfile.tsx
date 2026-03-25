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
    MapPin,
    FileText,
    Upload,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition, useEffect } from 'react';
import { updateBookingStatus } from '@/features/bookings/actions';
import { cn } from '@/components/ui/utils';
import InternalNotesTimeline from '@/components/students/InternalNotesTimeline';

interface AssessmentProfileProps {
    student: {
        id: string;
        firstName: string;
        lastName: string;
        dateOfBirth: Date | null;
        schoolYear: string;
        notes: string | null;
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
    };
    initialNotes: Array<{
        id: string;
        content: string;
        authorName: string;
        createdAt: Date;
    }>;
}

export default function AssessmentProfile({ student, initialNotes }: AssessmentProfileProps) {
    const fullName = `${student.firstName} ${student.lastName}`;
    const parentFullName = `${student.parent.firstName} ${student.parent.lastName}`;

    // For MVP, we usually focus on the most recent/upcoming assessment
    const latestAssessment = student.bookings[0];

    const [isPending, startTransition] = useTransition();

    const handleStatusUpdate = (newStatus: 'attended' | 'cancelled' | 'booked') => {
        if (!latestAssessment) return;
        startTransition(async () => {
            try {
                await updateBookingStatus(latestAssessment.id, newStatus);
            } catch (error) {
                console.error('Failed to update status:', error);
            }
        });
    };

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
                    <button
                        onClick={() => handleStatusUpdate('booked')}
                        disabled={isPending || latestAssessment?.status === 'booked'}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Reschedule
                    </button>
                    <button
                        onClick={() => handleStatusUpdate('attended')}
                        disabled={isPending || latestAssessment?.status === 'attended'}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                        {isPending ? 'Updating...' : latestAssessment?.status === 'attended' ? 'Attended ✓' : 'Mark as Attended'}
                    </button>
                </div>
            </div>

            {/* Assessment Card Detail */}
            <div className="glass-card rounded-[48px] overflow-hidden shadow-2xl shadow-slate-200/50 border-white/50">
                {/* Visual Header */}
                <div className="bg-gradient-to-r from-primary/5 via-violet-500/5 to-transparent p-12 pb-0">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="w-32 h-32 rounded-[40px] bg-white shadow-xl flex items-center justify-center border-4 border-white/50 overflow-hidden relative group">
                            <User className="w-16 h-16 text-slate-200 group-hover:scale-110 transition-transform" />
                            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-center md:text-left space-y-2">
                            <div className="flex items-center justify-center md:justify-start gap-3">
                                <h1 className="text-4xl font-black text-slate-900 tracking-tight">{fullName}</h1>
                                <span className="px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full">Pre-Registration</span>
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

                    {/* Booking Stats Bar */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 border-t border-slate-100/50">
                        <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100/50 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assessment Date</span>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span className="text-lg font-black text-slate-900">
                                    {latestAssessment ? new Date(latestAssessment.startAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '-'}
                                </span>
                            </div>
                        </div>
                        <div className="p-8 border-b md:border-b-0 md:border-r border-slate-100/50 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Time Slot</span>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-violet-500" />
                                <span className="text-lg font-black text-slate-900">
                                    {latestAssessment ? new Date(latestAssessment.startAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                </span>
                            </div>
                        </div>
                        <div className="p-8 flex flex-col gap-1 items-center md:items-start">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</span>
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-emerald-500" />
                                <span className="text-lg font-black text-slate-900">{latestAssessment?.centreName || '-'}</span>
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
                                        <p className="text-xs font-bold text-primary italic">Assessment Point of Contact</p>
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

                        {latestAssessment && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100">
                                    <FileText className="w-6 h-6 text-slate-400 mb-3" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latest Booking</p>
                                    <p className="text-sm font-black text-slate-900">#BK-{latestAssessment.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100">
                                    <Clock className="w-6 h-6 text-slate-400 mb-3" />
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                                    <p className={cn(
                                        "text-sm font-black uppercase text-[10px] rounded-full px-2 py-0.5 inline-block",
                                        latestAssessment.status === 'attended' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'
                                    )}>
                                        {latestAssessment.status || 'Active'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
