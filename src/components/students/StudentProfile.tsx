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
import { updateBookingStatus, saveAssessmentFeedback, sendAssessmentFeedback } from '@/features/bookings/actions';
import { cn } from '@/components/ui/utils';

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
}

export default function AssessmentProfile({ student }: AssessmentProfileProps) {
    const fullName = `${student.firstName} ${student.lastName}`;
    const parentFullName = `${student.parent.firstName} ${student.parent.lastName}`;

    // For MVP, we usually focus on the most recent/upcoming assessment
    const latestAssessment = student.bookings[0];

    // Local State for Feedback
    const [notes, setNotes] = useState(latestAssessment?.feedbackNotes || '');
    const [score, setScore] = useState(latestAssessment?.feedbackScore || '');
    const [status, setStatus] = useState(latestAssessment?.feedbackStatus || 'PENDING');
    const [fileBase64, setFileBase64] = useState<string | null>(latestAssessment?.feedbackAttachmentBase64 || null);
    const [mimeType, setMimeType] = useState<string | null>(latestAssessment?.feedbackAttachmentMime || null);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const [isPending, startTransition] = useTransition();
    const [isSaving, startSaving] = useTransition();
    const [isSending, startSending] = useTransition();

    useEffect(() => {
        if (latestAssessment) {
            setNotes(latestAssessment.feedbackNotes || '');
            setScore(latestAssessment.feedbackScore || '');
            setStatus(latestAssessment.feedbackStatus || 'PENDING');
            setFileBase64(latestAssessment.feedbackAttachmentBase64 || null);
            setMimeType(latestAssessment.feedbackAttachmentMime || null);
        }
    }, [latestAssessment]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) { // 2MB
            setUploadError('File size must be less than 2MB');
            return;
        }

        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            setUploadError('Only JPG/PNG images allowed');
            return;
        }

        setUploadError(null);
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setFileBase64(base64);
            setMimeType(file.type);
        };
        reader.readAsDataURL(file);
    };

    const handleStatusUpdate = (newStatus: 'completed' | 'cancelled' | 'confirmed') => {
        if (!latestAssessment) return;
        startTransition(async () => {
            try {
                await updateBookingStatus(latestAssessment.id, newStatus);
            } catch (error) {
                console.error('Failed to update status:', error);
            }
        });
    };

    const handleSave = () => {
        if (!latestAssessment) return;
        startSaving(async () => {
            try {
                await saveAssessmentFeedback(latestAssessment.attendeeId, {
                    notes,
                    score,
                    base64: fileBase64 || undefined,
                    mime: mimeType || undefined
                });
                if (status !== 'SENT') setStatus('DRAFT');
            } catch (error) {
                console.error('Failed to save feedback:', error);
            }
        });
    };

    const handleSend = () => {
        if (!latestAssessment) return;
        if (!confirm('Are you sure you want to send this feedback to the parent? This action cannot be undone.')) return;
        startSending(async () => {
            try {
                // Save first to ensure server has latest data before marking sent
                await saveAssessmentFeedback(latestAssessment.attendeeId, {
                    notes,
                    score,
                    base64: fileBase64 || undefined,
                    mime: mimeType || undefined
                });
                await sendAssessmentFeedback(latestAssessment.attendeeId);
                setStatus('SENT');
            } catch (error) {
                console.error('Failed to send feedback:', error);
            }
        });
    };

    const isAssessmentComplete = status === 'SENT';

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
                        onClick={() => handleStatusUpdate('confirmed')}
                        disabled={isPending || latestAssessment?.status === 'confirmed'}
                        className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        Reschedule
                    </button>
                    <button
                        onClick={() => handleStatusUpdate('completed')}
                        disabled={isPending || latestAssessment?.status === 'completed'}
                        className="px-6 py-3 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                        {isPending ? 'Updating...' : latestAssessment?.status === 'completed' ? 'Attended ✓' : 'Mark as Attended'}
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

                    {/* Right Panel: Assessment & Feedback */}
                    <div className="space-y-8">
                        <div>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Assessment & Feedback</h3>
                                <div className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                                    status === 'SENT' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                        status === 'DRAFT' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                            'bg-slate-100 text-slate-500 border-slate-200'
                                )}>
                                    {status}
                                </div>
                            </div>

                            <div className="bg-white rounded-[32px] p-8 border border-slate-100 space-y-6">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Score (Optional)</label>
                                    <input
                                        type="text"
                                        value={score}
                                        onChange={(e) => setScore(e.target.value)}
                                        placeholder="e.g. 8/10 or A"
                                        disabled={isAssessmentComplete}
                                        className="w-full bg-slate-50 border-slate-100 text-slate-900 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tutor Observations</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Add assessment observations here..."
                                        disabled={isAssessmentComplete}
                                        className="w-full bg-slate-50 border-slate-100 text-slate-900 rounded-2xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 min-h-[150px] resize-none transition-all disabled:opacity-50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Marked Assessment (Photo)</label>
                                    {fileBase64 ? (
                                        <div className="relative group rounded-[32px] overflow-hidden border border-slate-100 shadow-sm">
                                            <img src={fileBase64} alt="Assessment" className="w-full h-48 object-cover" />
                                            {!isAssessmentComplete && (
                                                <button
                                                    onClick={() => { setFileBase64(null); setMimeType(null); }}
                                                    className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-slate-900 p-2 rounded-2xl shadow-lg hover:bg-white transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        !isAssessmentComplete && (
                                            <div className="relative border-2 border-dashed border-slate-100 rounded-[32px] p-8 flex flex-col items-center justify-center text-center group hover:border-primary/30 transition-all cursor-pointer">
                                                <Upload className="w-8 h-8 text-slate-300 mb-3 group-hover:scale-110 group-hover:text-primary transition-all" />
                                                <p className="text-xs font-bold text-slate-400">Click to upload photo of marked paper</p>
                                                <p className="text-[10px] text-slate-300 mt-1 uppercase">PNG, JPG up to 2MB</p>
                                                <input type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileChange} accept="image/png, image/jpeg" />
                                            </div>
                                        )
                                    )}
                                    {uploadError && <p className="text-xs text-rose-500 mt-2 font-bold">{uploadError}</p>}
                                </div>

                                {!isAssessmentComplete && (
                                    <div className="flex gap-3 pt-4 border-t border-slate-50">
                                        <button
                                            onClick={handleSave}
                                            disabled={isSaving || isSending}
                                            className="flex-1 px-4 py-3 bg-slate-50 text-slate-700 font-bold rounded-2xl hover:bg-slate-100 transition-all text-sm disabled:opacity-50"
                                        >
                                            {isSaving ? 'Saving...' : 'Save Draft'}
                                        </button>
                                        <button
                                            onClick={handleSend}
                                            disabled={isSaving || isSending || (!notes && !fileBase64)}
                                            className="flex-[1.5] px-4 py-3 bg-slate-900 text-white font-bold rounded-2xl shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all text-sm disabled:opacity-50"
                                        >
                                            {isSending ? 'Sending...' : 'Send to Parent'}
                                        </button>
                                    </div>
                                )}

                                {isAssessmentComplete && latestAssessment?.feedbackSentAt && (
                                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center gap-2">
                                        <FileText className="w-4 h-4 text-emerald-600" />
                                        <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                                            Feedback sent on {new Date(latestAssessment.feedbackSentAt).toLocaleDateString('en-GB')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100">
                                <FileText className="w-6 h-6 text-slate-400 mb-3" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Booking ID</p>
                                <p className="text-sm font-black text-slate-900">#BK-{latestAssessment?.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                            <div className="p-6 rounded-[32px] bg-slate-50 border border-slate-100">
                                <Clock className="w-6 h-6 text-slate-400 mb-3" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                                <p className={cn(
                                    "text-sm font-black uppercase text-[10px] rounded-full px-2 py-0.5 inline-block",
                                    latestAssessment?.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'
                                )}>
                                    {latestAssessment?.status || 'Active'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
