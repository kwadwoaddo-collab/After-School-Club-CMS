'use client';
import { logger } from '@/lib/logger';

import { useRouter } from 'next/navigation';
import { updateBookingStatus } from '@/features/bookings/actions';
import { useTransition, useState, useEffect } from 'react';
import { Calendar, User, Clock, ChevronRight } from 'lucide-react';
import { AttendanceRadial } from '@/components/ui/AttendanceRadial';

interface Student {
    id: string;
    uniqueKey?: string; // Composite key for React rendering
    firstName: string;
    lastName: string;
    grade: string | null;
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string | null;
    parentEmail: string | null;
    nextAppointment: Date | null;
    centreName: string | null;
    bookingId: string | null;
    status: 'confirmed' | 'cancelled' | 'rescheduled' | 'completed' | null;
    attendanceRate?: number;
}

interface RecentStudentsTableProps {
    students: Student[];
}

export default function RecentStudentsTable({ students }: RecentStudentsTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleRowClick = (student: Student) => {
        router.push(`/dashboard/students/${student.id}`);
    };

    const handleStatusClick = (e: React.MouseEvent, student: Student) => {
        e.stopPropagation();
        if (!student.bookingId || !student.status || isPending) return;

        const nextStatusMap: Record<string, 'completed' | 'cancelled' | 'confirmed'> = {
            'confirmed': 'completed',
            'completed': 'cancelled',
            'cancelled': 'confirmed',
            'rescheduled': 'confirmed',
        };

        const currentStatus = student.status;
        const nextStatus = nextStatusMap[currentStatus] || 'confirmed';

        startTransition(async () => {
            try {
                await updateBookingStatus(student.bookingId!, nextStatus);
            } catch (error) {
                logger.error('Failed to update status', error);
            }
        });
    };

    const getStatusIndicator = (status: string | null) => {
        if (!status) return null;

        const config = {
            confirmed: {
                color: 'bg-primary',
                bg: 'bg-primary/10',
                border: 'border-primary/20',
                text: 'Confirmed'
            },
            completed: {
                color: 'bg-success',
                bg: 'bg-success/10',
                border: 'border-success/20',
                text: 'Completed'
            },
            cancelled: {
                color: 'bg-destructive',
                bg: 'bg-destructive/10',
                border: 'border-destructive/20',
                text: 'Cancelled'
            },
            rescheduled: {
                color: 'bg-warning',
                bg: 'bg-warning/10',
                border: 'border-warning/20',
                text: 'Rescheduled'
            },
        };

        const { color, bg, border, text } = config[status as keyof typeof config] || { color: 'bg-muted', bg: 'bg-secondary', border: 'border-border', text: status };

        return (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${bg} border ${border} w-fit transition-all group-hover:scale-105`}>
                <span className={`status-dot ${color}`}></span>
                <span className={`text-[10px] font-bold text-muted-foreground uppercase tracking-widest`}>{text}</span>
            </div>
        );
    };

    const formatApptDate = (date: Date) => {
        if (!mounted) return '…';
        return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const formatApptTime = (date: Date) => {
        if (!mounted) return '';
        return new Date(date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
                <thead>
                    <tr className="border-b border-border">
                        <th className="px-8 py-5 font-bold text-[11px] text-muted-foreground uppercase tracking-widest">Student</th>
                        <th className="px-6 py-5 font-bold text-[11px] text-muted-foreground uppercase tracking-widest">Appointment</th>
                        <th className="px-6 py-5 font-bold text-[11px] text-muted-foreground uppercase tracking-widest">Status</th>
                        <th className="px-6 py-5 font-bold text-[11px] text-muted-foreground uppercase tracking-widest">Parent & Contact</th>
                        <th className="px-6 py-5 font-bold text-[11px] text-muted-foreground uppercase tracking-widest text-right">Action</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {students.length === 0 ? (
                        <tr>
                            <td colSpan={5} className="px-8 py-12 text-center text-muted-foreground font-medium">
                                No recent bookings found.
                            </td>
                        </tr>
                    ) : (
                        students.map((student) => {
                            // Generate gradient colors based on initials
                            const colorPairs = [
                                ['from-purple-500', 'to-pink-500'],
                                ['from-cyan-500', 'to-blue-500'],
                                ['from-amber-500', 'to-orange-500'],
                                ['from-emerald-500', 'to-cyan-500'],
                                ['from-pink-500', 'to-purple-500'],
                            ];
                            const hash = (student.firstName[0] + student.lastName[0]).charCodeAt(0) % colorPairs.length;
                            const [fromColor, toColor] = colorPairs[hash];

                            return (
                                <tr
                                    key={student.uniqueKey || student.id}
                                    className="group hover:bg-secondary transition-all cursor-pointer relative"
                                    onClick={() => handleRowClick(student)}
                                >
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <AttendanceRadial percentage={student.attendanceRate || 0} size="md">
                                                <div className={`w-full h-full bg-gradient-to-br ${fromColor} ${toColor} flex items-center justify-center text-white font-bold text-sm transition-all`}>
                                                    {student.firstName[0]}{student.lastName[0]}
                                                </div>
                                            </AttendanceRadial>
                                            <div>
                                                <div className="font-bold text-foreground leading-none">{student.firstName} {student.lastName}</div>
                                                <div className="text-[10px] font-bold text-primary mt-2 px-2 py-0.5 bg-primary/10 rounded-lg w-fit uppercase border border-primary/20 tracking-widest">{student.grade}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <Calendar className="w-4 h-4 text-primary" />
                                            <div className="text-sm font-medium">
                                                {student.nextAppointment ? (
                                                    <>
                                                        <span className="text-foreground font-bold">{formatApptDate(student.nextAppointment)}</span>
                                                        <span className="text-muted-foreground ml-2">{formatApptTime(student.nextAppointment)}</span>
                                                    </>
                                                ) : '-'}
                                            </div>
                                        </div>
                                        {student.centreName && (
                                            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground font-medium">
                                                <Clock className="w-3 h-3" />
                                                <span>{student.centreName}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-5">
                                        <div onClick={(e) => handleStatusClick(e, student)}>
                                            {getStatusIndicator(student.status)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div>
                                            <div className="font-bold text-foreground text-sm leading-tight">
                                                {student.parentFirstName} {student.parentLastName}
                                            </div>
                                            <div className="text-xs text-muted-foreground font-medium mt-2">{student.parentEmail || student.parentPhone || 'No contact'}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <button className="text-primary group-hover:text-primary group-hover:translate-x-1 transition-all transform inline-flex items-center justify-center w-8 h-8 rounded-lg group-hover:bg-primary/10">
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}
