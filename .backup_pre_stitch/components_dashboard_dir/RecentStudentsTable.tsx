'use client';

import { useRouter } from 'next/navigation';
import { updateBookingStatus } from '@/features/bookings/actions';
import { useTransition } from 'react';

interface Student {
    id: string;
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
}

interface RecentStudentsTableProps {
    students: Student[];
}

export default function RecentStudentsTable({ students }: RecentStudentsTableProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleRowClick = (student: Student) => {
        if (student.bookingId) {
            router.push(`/dashboard/bookings/${student.bookingId}`);
        }
    };

    const handleStatusClick = (e: React.MouseEvent, student: Student) => {
        e.stopPropagation(); // Prevent row navigation
        if (!student.bookingId || !student.status || isPending) return;

        // Cycle: confirmed -> completed -> cancelled -> confirmed
        const nextStatusMap: Record<string, 'completed' | 'cancelled' | 'confirmed'> = {
            'confirmed': 'completed',
            'completed': 'cancelled',
            'cancelled': 'confirmed',
            'rescheduled': 'confirmed', // Treat rescheduled as confirmed for cycling purposes or reset
        };

        const currentStatus = student.status;
        const nextStatus = nextStatusMap[currentStatus] || 'confirmed';

        startTransition(async () => {
            try {
                await updateBookingStatus(student.bookingId!, nextStatus);
            } catch (error) {
                console.error('Failed to update status', error);
            }
        });
    };

    const getStatusBadge = (status: string | null) => {
        if (!status) return <span className="text-gray-400">-</span>;

        const styles = {
            confirmed: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
            completed: 'bg-green-100 text-green-800 hover:bg-green-200',
            cancelled: 'bg-red-100 text-red-800 hover:bg-red-200',
            rescheduled: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
        };

        const label = {
            confirmed: 'Scheduled',
            completed: 'Attended',
            cancelled: 'No Show',
            rescheduled: 'Rescheduled',
        };

        const statusKey = status as keyof typeof styles;
        const className = styles[statusKey] || 'bg-gray-100 text-gray-800';
        const text = label[statusKey] || status;

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${className}`}>
                {text}
            </span>
        );
    };

    return (
        <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left min-w-[1000px]">
                <thead className="bg-gray-50/50">
                    <tr className="border-b border-gray-200">
                        <th className="px-6 py-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Appt Date & Time</th>
                        <th className="px-6 py-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Student Name</th>
                        <th className="px-6 py-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Year</th>
                        <th className="px-6 py-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Parent</th>
                        <th className="px-6 py-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Parent Contact</th>
                        <th className="px-6 py-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Centre</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {students.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-gray-500 italic">
                                No students added yet.
                            </td>
                        </tr>
                    ) : (
                        students.map((student) => (
                            <tr
                                key={student.id}
                                className={`group transition-colors ${student.bookingId ? 'hover:bg-gray-50/80 cursor-pointer' : ''}`}
                                onClick={() => handleRowClick(student)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div onClick={(e) => handleStatusClick(e, student)}>
                                        {getStatusBadge(student.status)}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {student.nextAppointment ? (
                                        <div className="flex items-center gap-1.5 text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                            {new Date(student.nextAppointment).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="font-medium text-gray-900">{student.firstName} {student.lastName}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                        {student.grade}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {student.parentFirstName} {student.parentLastName}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    <div className="flex flex-col">
                                        <span>{student.parentPhone || '-'}</span>
                                        <span className="text-gray-400 text-xs">{student.parentEmail || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                    {student.centreName ? (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                                            {student.centreName}
                                        </span>
                                    ) : '-'}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
